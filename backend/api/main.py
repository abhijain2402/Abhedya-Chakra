import sys
import time
import shutil
from pathlib import Path
from typing import Optional

import polars as pl
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Abhedya Chakra API",
    description="Explainable Mule-Account Risk Analysis, Fund Tracing & Investigation API",
    version="2.1.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Locate project root
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DATA_DIR = PROJECT_ROOT / "data" / "processed"
UPLOAD_DIR = PROJECT_ROOT / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

RISK_DATA_PATH = DATA_DIR / "integrated_risk_features_v1.parquet"
LAYER_DATA_PATH = DATA_DIR / "account_layer_classification_v1.parquet"
RAPID_DATA_PATH = DATA_DIR / "rapid_pass_through_candidates_v5.parquet"
TX_DATA_PATH = DATA_DIR / "transaction_edges_with_row_id.parquet"
DEFAULT_DATASET_NAME = "VoidHacks8_MuleAccount_2M_Transactions.csv"

# Import cached tracing functions
from backend.tracing.cached_fund_tracing import (
    load_outgoing,
    trace_funds
)
from backend.detection.isolation_forest import add_isolation_forest_scores

# Load data once at startup
print("[API] Loading datasets into memory...")
start_t = time.perf_counter()

risk_df = pl.read_parquet(RISK_DATA_PATH)
layer_df = pl.read_parquet(LAYER_DATA_PATH)
rapid_df = pl.read_parquet(RAPID_DATA_PATH) if RAPID_DATA_PATH.exists() else pl.DataFrame()

# Join risk and layer features for merged query efficiency
merged_df = risk_df.join(layer_df, on="Account_ID", how="left")
merged_df = add_isolation_forest_scores(merged_df)
merged_df = merged_df.with_columns(
    (
        (pl.col("Final_Risk_Percentile") >= 80.0)
        & pl.col("Isolation_Forest_Anomaly")
    ).alias("Anomaly_Supported_Candidate")
)
rule_based_candidate_count = merged_df.filter(
    pl.col("Final_Risk_Percentile") >= 80.0
).height
anomaly_supported_candidate_count = merged_df.filter(
    pl.col("Anomaly_Supported_Candidate")
).height


def get_rapid_candidate_rows() -> pl.DataFrame:
    if rapid_df.is_empty() or "Pass_Through_Flag" not in rapid_df.columns:
        return rapid_df
    return rapid_df.filter(pl.col("Pass_Through_Flag").fill_null(False))


def get_rapid_candidate_account_count() -> int:
    candidates = get_rapid_candidate_rows()
    return candidates["Account_ID"].n_unique() if not candidates.is_empty() else 0


# Lazy query object for transaction edges
tx_lazy = pl.scan_parquet(TX_DATA_PATH)

load_dur = time.perf_counter() - start_t
print(f"[API] Datasets loaded in {load_dur:.2f} seconds. Accounts: {merged_df.height:,}")


@app.get("/")
def home():
    return {
        "project": "Abhedya Chakra",
        "status": "running",
        "version": "2.1.0",
        "message": "Explainable Mule-Account Risk Analysis & Fund Tracing API"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "datasets": {
            "accounts_loaded": merged_df.height,
            "rapid_pass_through_candidates": get_rapid_candidate_account_count()
        }
    }


@app.get("/overview/stats")
def get_overview_stats():
    total_accounts = merged_df.height
    total_tx = 2_000_000

    candidate_count = anomaly_supported_candidate_count
    outside_candidate_count = total_accounts - candidate_count

    layer_counts = (
        merged_df.group_by("Layer")
        .count()
        .to_dicts()
    )
    layer_dict = {item["Layer"]: item["count"] for item in layer_counts if item["Layer"] is not None}
    rapid_count = get_rapid_candidate_account_count()

    return {
        "total_accounts": total_accounts,
        "total_transactions": total_tx,
        "anomaly_supported_candidate_count": candidate_count,
        "accounts_requiring_review": candidate_count,
        "lower_priority_accounts": outside_candidate_count,
        "rule_based_candidate_count": rule_based_candidate_count,
        "rule_only_excluded_count": (
            rule_based_candidate_count - candidate_count
        ),
        "outside_candidate_count": outside_candidate_count,
        "candidate_method": (
            "Final risk percentile >= 80 and Isolation Forest anomaly"
        ),
        "layer_counts": {
            "L1_Collector": layer_dict.get("L1_Collector", 0),
            "L2_Distributor": layer_dict.get("L2_Distributor", 0),
            "L3_Terminal": layer_dict.get("L3_Terminal", 0),
            "Unclassified": layer_dict.get("Unclassified", 0)
        },
        "rapid_pass_through_candidates": rapid_count,
        "dataset_filename": "VoidHacks8_MuleAccount_2M_Transactions.csv",
        "dataset_size_mb": 286.7,
        "indexed_accounts_count": total_accounts
    }


@app.get("/accounts")
def list_accounts(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = None,
    layer: Optional[str] = None,
    min_risk: Optional[float] = None,
    sort_by: str = Query(default="priority", pattern="^(priority|risk|account_id)$")
):
    df = merged_df

    if search:
        df = df.filter(pl.col("Account_ID").str.to_uppercase().contains(search.upper()))

    if layer and layer != "ALL":
        df = df.filter(pl.col("Layer") == layer)

    if min_risk is not None:
        df = df.filter(pl.col("Final_Risk_Percentile") >= min_risk)

    if sort_by == "priority":
        df = df.sort("Experimental_Investigation_Priority", descending=True)
    elif sort_by == "risk":
        df = df.sort("Final_Risk_Percentile", descending=True)
    elif sort_by == "account_id":
        df = df.sort("Account_ID", descending=False)

    total_records = df.height
    offset = (page - 1) * limit
    page_rows = df.slice(offset, limit).to_dicts()

    results = []
    for r in page_rows:
        results.append({
            "account_id": r["Account_ID"],
            "layer": r.get("Layer", "Unclassified"),
            "final_risk_percentile": r.get("Final_Risk_Percentile"),
            "fan_risk_percentile": r.get("Fan_Risk_Percentile"),
            "graph_risk_percentile": r.get("Graph_Risk_Percentile"),
            "temporal_risk_percentile": r.get("Temporal_Risk_Percentile"),
            "experimental_priority": r.get("Experimental_Investigation_Priority"),
            "isolation_forest_score": r.get("Isolation_Forest_Score"),
            "isolation_forest_anomaly": r.get("Isolation_Forest_Anomaly"),
            "anomaly_supported_candidate": r.get("Anomaly_Supported_Candidate"),
            "review_priority_label": (
                "Anomaly-supported review candidate"
                if r.get("Anomaly_Supported_Candidate")
                else "Not selected by combined screening"
            )
        })

    return {
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": (total_records + limit - 1) // limit,
        "accounts": results
    }


@app.get("/accounts/review-suggestions")
def get_review_suggestions():
    high_prio = (
        merged_df.filter(pl.col("Anomaly_Supported_Candidate"))
        .sort("Experimental_Investigation_Priority", descending=True)
        .head(3)
        .to_dicts()
    )

    low_prio = (
        merged_df.sort("Experimental_Investigation_Priority", descending=False)
        .slice(1000, 2)
        .to_dicts()
    )

    suggestions = []
    for item in high_prio:
        suggestions.append({
            "account_id": item["Account_ID"],
            "total_risk_percentile": item["Final_Risk_Percentile"],
            "experimental_priority": item["Experimental_Investigation_Priority"],
            "layer": item.get("Layer", "Unclassified"),
            "review_category": "Higher-priority review candidate",
            "top_signals": [
                f"Top {100 - item['Final_Risk_Percentile']:.1f}% risk percentile",
                f"Layer: {item.get('Layer', 'Unclassified')}",
                f"Graph percentile: {item.get('Graph_Risk_Percentile', 0):.1f}%"
            ]
        })

    for item in low_prio:
        suggestions.append({
            "account_id": item["Account_ID"],
            "total_risk_percentile": item["Final_Risk_Percentile"],
            "experimental_priority": item["Experimental_Investigation_Priority"],
            "layer": item.get("Layer", "Unclassified"),
            "review_category": "Not selected by combined screening",
            "top_signals": [
                f"Lower risk percentile ({item['Final_Risk_Percentile']:.1f}%)",
                "Did not pass both combined screening conditions",
                f"Layer: {item.get('Layer', 'Unclassified')}"
            ]
        })

    return {
        "suggestions": suggestions
    }


# FULL DATASET CSV EXPORT ENDPOINTS
@app.get("/exports/high-risk")
def export_high_risk_csv():
    candidates = merged_df.filter(
        pl.col("Anomaly_Supported_Candidate")
    ).sort("Experimental_Investigation_Priority", descending=True)
    csv_str = candidates.write_csv()
    filename = "AbhedyaChakra_Anomaly_Supported_Candidates.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/exports/low-risk")
def export_low_risk_csv():
    low_df = merged_df.filter(
        ~pl.col("Anomaly_Supported_Candidate")
    ).sort("Experimental_Investigation_Priority", descending=True)
    csv_str = low_df.write_csv()
    filename = "AbhedyaChakra_Other_Screening_Results.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/exports/rapid-pass-through")
def export_rapid_pass_through_csv():
    columns = {
        "Account_ID": pl.String,
        "Qualifying_Pass_Through_Events": pl.UInt32,
    }
    aggregations = [
        pl.len().alias("Qualifying_Pass_Through_Events"),
    ]
    for column in [
        "Outgoing_Incoming_Ratio",
        "Incoming_Amount",
        "Outgoing_Amount_3_to_15m",
        "Outgoing_Transaction_Count",
        "Distinct_Downstream_Accounts",
    ]:
        if column in rapid_df.columns:
            aggregations.append(pl.col(column).max().alias(f"Max_{column}"))
            columns[f"Max_{column}"] = rapid_df.schema[column]

    if rapid_df.is_empty() or "Account_ID" not in rapid_df.columns:
        accounts = pl.DataFrame(schema=columns)
    else:
        flagged = get_rapid_candidate_rows()
        accounts = flagged.group_by("Account_ID").agg(aggregations).sort(
            "Account_ID"
        )

    if not accounts.is_empty():
        risk_columns = [
            column
            for column in [
                "Final_Risk_Percentile",
                "Experimental_Investigation_Priority",
                "Anomaly_Supported_Candidate",
            ]
            if column in merged_df.columns
        ]
        if risk_columns:
            accounts = accounts.join(
                merged_df.select("Account_ID", *risk_columns),
                on="Account_ID",
                how="left",
            )

    csv_content = accounts.write_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                'attachment; filename="AbhedyaChakra_Rapid_Pass_Through_Accounts.csv"'
            ),
            "X-Account-Count": str(accounts.height),
        },
    )


@app.get("/accounts/{account_id}/details")
def get_account_details(account_id: str):
    res = merged_df.filter(pl.col("Account_ID") == account_id)
    if res.is_empty():
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

    row = res.row(0, named=True)

    rapid_info = None
    rapid_candidates = get_rapid_candidate_rows()
    if not rapid_candidates.is_empty():
        r_res = rapid_candidates.filter(pl.col("Account_ID") == account_id)
        if not r_res.is_empty():
            r_row = r_res.row(0, named=True)
            rapid_info = {
                "is_candidate": True,
                "incoming_timestamp": str(r_row.get("Incoming_Timestamp", "")),
                "incoming_amount": r_row.get("Incoming_Amount"),
                "outgoing_amount_3_to_15m": r_row.get("Outgoing_Amount_3_to_15m"),
                "outgoing_transaction_count": r_row.get("Outgoing_Transaction_Count"),
                "dispersal_ratio": r_row.get("Outgoing_Incoming_Ratio"),
                "distinct_downstream_accounts": r_row.get("Distinct_Downstream_Accounts"),
                "downstream_accounts": r_row.get("Downstream_Accounts", [])
            }

    reasons = []
    final_p = row.get("Final_Risk_Percentile", 0)
    graph_p = row.get("Graph_Risk_Percentile", 0)
    fan_p = row.get("Fan_Risk_Percentile", 0)
    temp_p = row.get("Temporal_Risk_Percentile", 0)
    isolation_anomaly = bool(row.get("Isolation_Forest_Anomaly"))

    if final_p >= 95:
        reasons.append(f"High overall risk (ranks in top {100-final_p:.1f}% of all dataset accounts)")
    if graph_p >= 90:
        reasons.append(f"High network concentration (Graph percentile {graph_p:.1f}%)")
    if fan_p >= 90:
        reasons.append(f"High fan activity (Fan risk percentile {fan_p:.1f}%)")
    if temp_p >= 90:
        reasons.append(f"Unusual temporal activity spike (Temporal percentile {temp_p:.1f}%)")
    if rapid_info:
        reasons.append(f"Rapid pass-through candidate (90%+ funds moved within 3–15 min window)")
    if row.get("Layer") in ["L1_Collector", "L2_Distributor", "L3_Terminal"]:
        reasons.append(f"Classified as {row.get('Layer')} based on structural transaction patterns")
    if isolation_anomaly:
        reasons.append("Isolation Forest identified an unusual combination of account behavior features")
    if final_p >= 80 and not isolation_anomaly:
        reasons.append(
            "The rule-based risk threshold was met, but Isolation Forest did not "
            "classify this feature profile as anomalous"
        )
    if final_p < 80 and isolation_anomaly:
        reasons.append(
            "Isolation Forest detected unusual behavior, but the rule-based "
            "risk threshold was not met"
        )

    if not reasons:
        reasons.append("No elevated configured risk signals were observed")

    anomaly_supported_candidate = bool(row.get("Anomaly_Supported_Candidate"))
    prio_label = (
        "Anomaly-supported review candidate"
        if anomaly_supported_candidate
        else "Not selected by combined screening"
    )

    return {
        "account_id": account_id,
        "anomaly_supported_candidate": anomaly_supported_candidate,
        "isolation_forest_anomaly": isolation_anomaly,
        "isolation_forest_score": row.get("Isolation_Forest_Score"),
        "review_priority_label": prio_label,
        "risk_scores": {
            "fan_risk_score": row.get("fan_risk_score"),
            "graph_risk_score": row.get("graph_risk_score"),
            "temporal_risk_score": row.get("Temporal_Risk_Score_V2"),
            "final_risk_score": row.get("Final_Risk_Score"),
        },
        "percentiles": {
            "fan": fan_p,
            "graph": graph_p,
            "temporal": temp_p,
            "final": final_p,
        },
        "experimental_investigation_priority": row.get("Experimental_Investigation_Priority"),
        "layer": row.get("Layer", "Unclassified"),
        "layer_evidence": row.get("Layer_Evidence"),
        "graph_features": {
            "incoming_count": row.get("Incoming_Count"),
            "outgoing_count": row.get("Outgoing_Count"),
            "unique_incoming_senders": row.get("Unique_Incoming_Senders"),
            "unique_outgoing_receivers": row.get("Unique_Outgoing_Receivers"),
            "collector_pattern_flag": row.get("Collector_Pattern_Flag"),
            "distributor_pattern_flag": row.get("Distributor_Pattern_Flag"),
            "graph_role_pattern": row.get("Graph_Role_Pattern")
        },
        "rapid_pass_through": rapid_info or {"is_candidate": False},
        "why_review_reasons": reasons
    }


@app.get("/accounts/{account_id}/risk")
def get_account_risk(account_id: str):
    return get_account_details(account_id)


# ENRICHED TRANSACTION HISTORY WITH HOP COLUMN
@app.get("/accounts/{account_id}/transactions")
def get_account_transactions(
    account_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    direction: str = Query(default="all", pattern="^(all|incoming|outgoing)$")
):
    if direction == "incoming":
        filter_expr = pl.col("Receiver_Account") == account_id
    elif direction == "outgoing":
        filter_expr = pl.col("Sender_Account") == account_id
    else:
        filter_expr = (pl.col("Sender_Account") == account_id) | (pl.col("Receiver_Account") == account_id)

    tx_filtered = (
        tx_lazy.filter(filter_expr)
        .sort("Timestamp", descending=True)
        .collect()
    )

    # Perform quick trace lookup to enrich transactions with Hop numbers if traced
    hop_map = {}
    try:
        outgoing = load_outgoing()
        paths = trace_funds(account_id, outgoing, max_hops=4, max_outgoing=10, max_paths=50)
        for path in (paths or []):
            for hop_num, edge in enumerate(path, start=1):
                txn_id = edge[2]
                if txn_id not in hop_map:
                    hop_map[txn_id] = f"Hop {hop_num}"
    except Exception:
        pass

    total_count = tx_filtered.height
    offset = (page - 1) * limit
    sliced = tx_filtered.slice(offset, limit).to_dicts()

    formatted_txs = []
    for r in sliced:
        txn_id = r["Transaction_ID"]
        formatted_txs.append({
            "source_row_id": r["Source_Row_ID"],
            "transaction_id": txn_id,
            "sender_account": r["Sender_Account"],
            "receiver_account": r["Receiver_Account"],
            "amount": float(r["Amount"]) if r["Amount"] is not None else 0.0,
            "timestamp": str(r["Timestamp"]),
            "direction": "IN" if r["Receiver_Account"] == account_id else "OUT",
            "hop": hop_map.get(txn_id, "-")
        })

    return {
        "account_id": account_id,
        "direction_filter": direction,
        "page": page,
        "limit": limit,
        "total_transactions": total_count,
        "total_pages": (total_count + limit - 1) // limit,
        "transactions": formatted_txs
    }


@app.get("/accounts/{account_id}/trace")
def trace_account_funds(
    account_id: str,
    max_hops: int = Query(default=4, ge=1, le=4),
    max_outgoing: int = Query(default=25, ge=1, le=100),
    max_paths: int = Query(default=1000, ge=1, le=1000)
):
    t_start = time.perf_counter()
    try:
        outgoing = load_outgoing()
        paths = trace_funds(
            account_id,
            outgoing,
            max_hops=max_hops,
            max_outgoing=max_outgoing,
            max_paths=max_paths
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    trace_time_sec = time.perf_counter() - t_start

    if not paths:
        raise HTTPException(
            status_code=404,
            detail="No eligible outgoing fund paths found for this account"
        )

    formatted_paths = []
    all_accounts = set([account_id])
    all_txs = set()

    for path_id, path in enumerate(paths, start=1):
        transactions = []
        for hop, edge in enumerate(path, start=1):
            timestamp, row_id, txn, sender, receiver, amount = edge
            all_accounts.add(sender)
            all_accounts.add(receiver)
            all_txs.add(txn)

            transactions.append({
                "hop": hop,
                "source_row_id": row_id,
                "transaction_id": txn,
                "sender_account": sender,
                "receiver_account": receiver,
                "amount": amount,
                "timestamp": timestamp
            })

        formatted_paths.append({
            "path_id": path_id,
            "hop_count": len(path),
            "start_timestamp": transactions[0]["timestamp"] if transactions else "",
            "end_timestamp": transactions[-1]["timestamp"] if transactions else "",
            "transactions": transactions
        })

    return {
        "account_id": account_id,
        "trace_type": "Chronological candidate paths",
        "max_hops": max_hops,
        "max_outgoing": max_outgoing,
        "max_paths": max_paths,
        "paths_found": len(formatted_paths),
        "total_accounts_found": len(all_accounts),
        "total_transactions_found": len(all_txs),
        "trace_time_seconds": round(trace_time_sec, 4),
        "paths": formatted_paths,
        "note": (
            "Chronological candidate paths are not proof of exact "
            "fund attribution or confirmed fraud."
        )
    }


# CLEAN GLOBAL NETWORK GRAPH ENDPOINT
@app.get("/network/global-graph")
def get_global_network_graph(limit_hubs: int = Query(default=25, ge=5, le=100)):
    # Select top high-risk hub accounts
    top_hubs = merged_df.sort("Experimental_Investigation_Priority", descending=True).head(limit_hubs)["Account_ID"].to_list()
    top_set = set(top_hubs)

    # Fetch outgoing transactions for top hubs
    outgoing = load_outgoing()

    nodes_map = {}
    edges_list = []
    edge_set = Set = set()

    # Add Hub Nodes
    for hub in top_hubs:
        res = merged_df.filter(pl.col("Account_ID") == hub)
        row = res.row(0, named=True) if not res.is_empty() else {}
        layer = row.get("Layer", "L1_Collector")
        prio = row.get("Final_Risk_Percentile", 99.0)

        nodes_map[hub] = {
            "id": hub,
            "label": f"{hub}\n({layer})",
            "layer": layer,
            "risk_percentile": prio,
            "is_hub": True
        }

        # Add outgoing edges from hub
        edges = outgoing.get(hub, [])[:8]  # Limit per hub to keep graph clean
        for edge in edges:
            timestamp, row_id, txn, sender, receiver, amount = edge
            if receiver not in nodes_map:
                nodes_map[receiver] = {
                    "id": receiver,
                    "label": receiver,
                    "layer": "Counterparty",
                    "risk_percentile": 50.0,
                    "is_hub": False
                }

            e_key = f"{sender}->{receiver}"
            if e_key not in edge_set:
                edge_set.add(e_key)
                edges_list.append({
                    "id": e_key,
                    "from": sender,
                    "to": receiver,
                    "amount": amount,
                    "timestamp": timestamp,
                    "transaction_id": txn
                })

    return {
        "total_nodes": len(nodes_map),
        "total_edges": len(edges_list),
        "nodes": list(nodes_map.values()),
        "edges": edges_list
    }


@app.get("/detection/signals")
def get_detection_signals():
    layer_counts = merged_df.group_by("Layer").count().to_dicts()
    rapid_count = get_rapid_candidate_account_count()

    return {
        "signals": [
            {
                "signal_name": "L1 Collector Pattern",
                "category": "Graph Topology",
                "count": next((i["count"] for i in layer_counts if i["Layer"] == "L1_Collector"), 0),
                "description": "Accounts receiving funds from multiple distinct senders"
            },
            {
                "signal_name": "L2 Distributor Pattern",
                "category": "Graph Topology",
                "count": next((i["count"] for i in layer_counts if i["Layer"] == "L2_Distributor"), 0),
                "description": "Accounts receiving and dispersing funds to multiple distinct receivers"
            },
            {
                "signal_name": "L3 Terminal Candidate",
                "category": "Endpoint Indicator",
                "count": next((i["count"] for i in layer_counts if i["Layer"] == "L3_Terminal"), 0),
                "description": "Accounts receiving funds with Crypto/P2P narration or headless IP indicators"
            },
            {
                "signal_name": "Rapid Pass-Through Candidate",
                "category": "Temporal Velocity",
                "count": rapid_count,
                "description": "Accounts transferring >=90% of incoming funds within a 3–15 minute window"
            },
            {
                "signal_name": "Top 1% Composite Risk",
                "category": "Risk Fusion",
                "count": merged_df.filter(pl.col("Final_Risk_Percentile") >= 99.0).height,
                "description": "Accounts in the 99th percentile across composite risk signals"
            }
        ]
    }


class AnalysisRequest(BaseModel):
    dataset_name: Optional[str] = DEFAULT_DATASET_NAME


def resolve_analysis_dataset(dataset_name: Optional[str]) -> Path:
    name = dataset_name or DEFAULT_DATASET_NAME
    if Path(name).name != name or Path(name).suffix.lower() not in {".csv", ".parquet"}:
        raise HTTPException(
            status_code=400,
            detail="Dataset name must be a CSV or Parquet filename without a directory path.",
        )

    candidates = [UPLOAD_DIR / name, PROJECT_ROOT / name]
    if name == DEFAULT_DATASET_NAME:
        candidates.extend(sorted(UPLOAD_DIR.glob("VoidHacks8_MuleAccount_2M_Transactions*.csv")))

    dataset_path = next((path for path in candidates if path.is_file()), None)
    if dataset_path is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{name}' was not found. Upload it first or restore the project dataset.",
        )
    return dataset_path


def load_transaction_scan(dataset_path: Path):
    if dataset_path.suffix.lower() == ".csv":
        transactions = pl.scan_csv(dataset_path, infer_schema=False)
    elif dataset_path.suffix.lower() == ".parquet":
        transactions = pl.scan_parquet(dataset_path)
    else:
        raise HTTPException(status_code=400, detail="Only CSV and Parquet datasets are supported.")

    columns = transactions.collect_schema().names()
    required_columns = ["Sender_Account", "Receiver_Account"]
    missing_columns = [column for column in required_columns if column not in columns]
    if missing_columns:
        raise HTTPException(
            status_code=422,
            detail=f"Transaction dataset is missing required columns: {', '.join(missing_columns)}",
        )
    return transactions, columns


def inspect_transaction_dataset(dataset_path: Path) -> dict:
    transactions, columns = load_transaction_scan(dataset_path)

    accounts = pl.concat(
        [
            transactions.select(
                pl.col("Sender_Account").cast(pl.String).alias("Account_ID"),
                pl.lit("sender").alias("Direction"),
            ),
            transactions.select(
                pl.col("Receiver_Account").cast(pl.String).alias("Account_ID"),
                pl.lit("receiver").alias("Direction"),
            ),
        ],
        how="vertical",
    )
    summary = accounts.select(
        (pl.len() // 2).alias("transaction_count"),
        pl.col("Account_ID").drop_nulls().n_unique().alias("account_count"),
        pl.col("Account_ID")
        .filter(pl.col("Direction") == "sender")
        .drop_nulls()
        .n_unique()
        .alias("sender_account_count"),
        pl.col("Account_ID")
        .filter(pl.col("Direction") == "receiver")
        .drop_nulls()
        .n_unique()
        .alias("receiver_account_count"),
        (pl.col("Account_ID").is_null() & (pl.col("Direction") == "sender"))
        .sum()
        .alias("missing_sender_account_count"),
        (pl.col("Account_ID").is_null() & (pl.col("Direction") == "receiver"))
        .sum()
        .alias("missing_receiver_account_count"),
    ).collect().row(0, named=True)
    return {"columns": columns, **summary}


@app.post("/analysis/run")
def run_dataset_analysis(req: AnalysisRequest):
    t0 = time.perf_counter()
    dataset_path = resolve_analysis_dataset(req.dataset_name)
    t1 = time.perf_counter()
    analysis = inspect_transaction_dataset(dataset_path)
    total_sec = time.perf_counter() - t0

    return {
        "status": "Dataset diagnostics complete",
        "dataset_name": dataset_path.name,
        "dataset_path": str(dataset_path.relative_to(PROJECT_ROOT)),
        "records_analyzed": analysis["transaction_count"],
        "accounts_analyzed": analysis["account_count"],
        "sender_accounts": analysis["sender_account_count"],
        "receiver_accounts": analysis["receiver_account_count"],
        "missing_sender_account_count": analysis["missing_sender_account_count"],
        "missing_receiver_account_count": analysis["missing_receiver_account_count"],
        "columns": analysis["columns"],
        "execution_timing": {
            "dataset_resolution_sec": round(t1 - t0, 3),
            "total_execution_sec": round(total_sec, 3)
        },
    }


# USER FILE UPLOAD FOR DATA ANALYSIS
@app.post("/analysis/upload")
async def upload_dataset_file(file: UploadFile = File(...)):
    t0 = time.perf_counter()
    filename = Path(file.filename or "").name
    if not filename or Path(filename).suffix.lower() not in {".csv", ".parquet"}:
        raise HTTPException(status_code=400, detail="Upload a .csv or .parquet transaction dataset.")

    save_path = UPLOAD_DIR / filename
    with save_path.open("wb") as output_file:
        shutil.copyfileobj(file.file, output_file)

    t1 = time.perf_counter()
    file_size_mb = save_path.stat().st_size / (1024 * 1024)
    _, columns = load_transaction_scan(save_path)

    t2 = time.perf_counter()
    total_sec = t2 - t0

    return {
        "status": "Transaction dataset uploaded and validated",
        "filename": filename,
        "size_mb": round(file_size_mb, 2),
        "columns": columns,
        "execution_timing": {
            "upload_write_sec": round(t1 - t0, 3),
            "schema_parsing_sec": round(t2 - t1, 3),
            "total_sec": round(total_sec, 3)
        }
    }


class ReportRequest(BaseModel):
    account_id: str


@app.post("/reports/generate")
def generate_report(req: ReportRequest):
    details = get_account_details(req.account_id)
    try:
        trace_data = trace_account_funds(req.account_id, max_hops=4, max_outgoing=25, max_paths=100)
    except HTTPException:
        trace_data = {"paths_found": 0, "paths": []}

    return {
        "report_id": f"REP-{req.account_id}-{int(time.time())}",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "account_id": req.account_id,
        "summary": {
            "review_priority": details["review_priority_label"],
            "total_risk_percentile": details["percentiles"]["final"],
            "layer": details["layer"],
            "experimental_priority": details["experimental_investigation_priority"]
        },
        "risk_breakdown": details["percentiles"],
        "why_detected": details["why_review_reasons"],
        "rapid_pass_through": details["rapid_pass_through"],
        "fund_tracing_summary": {
            "paths_found": trace_data.get("paths_found", 0),
            "total_accounts": trace_data.get("total_accounts_found", 0),
            "trace_time_seconds": trace_data.get("trace_time_seconds", 0.0)
        },
        "methodology": (
            "Heuristic multi-signal risk fusion, Isolation Forest anomaly "
            "screening, and chronological BFS fund tracing"
        ),
        "data_limitations": (
            "Isolation Forest is unsupervised and detects unusual behavior, not "
            "confirmed mule accounts. Chronological candidate paths are not proof "
            "of exact fund attribution or confirmed fraud."
        )
    }