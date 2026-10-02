
from pathlib import Path
import sys

import polars as pl
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(
    title="Abhedya Chakra API",
    description="Explainable Mule-Account Risk Analysis and Fund Tracing",
    version="1.1.0"
)

# Locate project
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

RISK_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "integrated_risk_features_v1.parquet"
)

# Import cached tracing functions
from backend.tracing.cached_fund_tracing import (
    load_outgoing,
    trace_funds
)

# Load risk data once when API starts
risk_df = pl.read_parquet(RISK_DATA_PATH)


@app.get("/")
def home():
    return {
        "project": "Abhedya Chakra",
        "status": "running",
        "message": "Risk Investigation API is ready"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/accounts/{account_id}/risk")
def get_account_risk(account_id: str):
    result = risk_df.filter(
        pl.col("Account_ID") == account_id
    )

    if result.is_empty():
        raise HTTPException(
            status_code=404,
            detail="Account not found"
        )

    account = result.row(0, named=True)

    return {
        "account_id": account["Account_ID"],
        "risk_scores": {
            "fan_risk_score": account["fan_risk_score"],
            "graph_risk_score": account["graph_risk_score"],
            "temporal_risk_score": account["Temporal_Risk_Score_V2"],
            "final_risk_score": account["Final_Risk_Score"],
        },
        "percentiles": {
            "fan": account["Fan_Risk_Percentile"],
            "graph": account["Graph_Risk_Percentile"],
            "temporal": account["Temporal_Risk_Percentile"],
            "final": account["Final_Risk_Percentile"],
        },
        "experimental_investigation_priority": account[
            "Experimental_Investigation_Priority"
        ],
        "score_note": (
            "Investigation prioritization scores, "
            "not calibrated fraud probabilities."
        )
    }


@app.get("/accounts/{account_id}/trace")
def trace_account_funds(
    account_id: str,
    max_hops: int = Query(default=4, ge=1, le=4),
    max_outgoing: int = Query(default=25, ge=1, le=100),
    max_paths: int = Query(default=1000, ge=1, le=1000)
):
    try:
        # Index loads only on first call in this process;
        # subsequent requests reuse the in-memory cache.
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

    if not paths:
        raise HTTPException(
            status_code=404,
            detail="No eligible outgoing fund paths found for this account"
        )

    formatted_paths = []

    for path_id, path in enumerate(paths, start=1):
        transactions = []

        for hop, edge in enumerate(path, start=1):
            timestamp, row_id, txn, sender, receiver, amount = edge

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
            "transactions": transactions
        })

    return {
        "account_id": account_id,
        "trace_type": "Chronological candidate paths",
        "max_hops": max_hops,
        "paths_found": len(formatted_paths),
        "paths": formatted_paths,
        "note": (
            "Chronological candidate paths are not proof of exact "
            "fund attribution or confirmed fraud."
        )
    }