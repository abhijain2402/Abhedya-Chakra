
from pathlib import Path
import duckdb
import pandas as pd
import numpy as np

# Project paths
ROOT = Path(__file__).resolve().parents[1]

CSV_FILE = ROOT / "VoidHacks8_MuleAccount_2M_Transactions.csv"
PARQUET_FILE = (
    ROOT / "data" / "processed" / "account_graph_features.parquet"
)
TEMP_DIR = ROOT / "artifacts" / "database" / "duckdb_tmp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

def test_graph_features():
    print("===== GRAPH FEATURES VALIDATION =====")

    # Check files
    if not CSV_FILE.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_FILE}")
    if not PARQUET_FILE.exists():
        raise FileNotFoundError(f"Parquet not found: {PARQUET_FILE}")

    # Read processed features
    features = pd.read_parquet(PARQUET_FILE)

    required = [
        "Account_ID",
        "Incoming_Count",
        "Outgoing_Count",
        "Total_Transactions",
        "Unique_Incoming_Senders",
        "Unique_Outgoing_Receivers",
        "Fan_In",
        "Fan_Out",
        "Total_Incoming_Amount",
        "Total_Outgoing_Amount",
    ]

    missing = [c for c in required if c not in features.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    print(f"Parquet rows: {len(features):,}")
    print(f"Parquet columns: {len(features.columns)}")
    print(f"Duplicate Account_IDs: {features['Account_ID'].duplicated().sum()}")
    print(f"Null Account_IDs: {features['Account_ID'].isna().sum()}")

    # Check fan columns internally
    fan_in_mismatch = (
        features["Fan_In"] != features["Unique_Incoming_Senders"]
    ).sum()
    fan_out_mismatch = (
        features["Fan_Out"] != features["Unique_Outgoing_Receivers"]
    ).sum()

    print(f"Internal Fan-in mismatches: {fan_in_mismatch}")
    print(f"Internal Fan-out mismatches: {fan_out_mismatch}")

    # Use DuckDB to aggregate original CSV without loading it
    # all into Pandas memory.
    csv_path = str(CSV_FILE).replace("\\", "/").replace("'", "''")
    temp_path = str(TEMP_DIR).replace("\\", "/").replace("'", "''")

    con = duckdb.connect()
    con.execute("SET memory_limit='1GB'")
    con.execute("SET threads=2")
    con.execute(f"SET temp_directory='{temp_path}'")

    query = f"""
        WITH tx AS (
            SELECT
                CAST(Sender_Account AS VARCHAR) AS sender,
                CAST(Receiver_Account AS VARCHAR) AS receiver,
                CAST(Amount AS DOUBLE) AS amount
            FROM read_csv_auto('{csv_path}', header=true)
        ),
        flows AS (
            SELECT
                TRIM(receiver) AS account_id,
                TRIM(sender) AS peer,
                'IN' AS direction,
                amount
            FROM tx

            UNION ALL

            SELECT
                TRIM(sender) AS account_id,
                TRIM(receiver) AS peer,
                'OUT' AS direction,
                amount
            FROM tx
        )
        SELECT
            account_id,
            COUNT(*) FILTER (WHERE direction = 'IN') AS csv_incoming_count,
            COUNT(*) FILTER (WHERE direction = 'OUT') AS csv_outgoing_count,
            COUNT(DISTINCT peer) FILTER (WHERE direction = 'IN')
                AS csv_unique_incoming,
            COUNT(DISTINCT peer) FILTER (WHERE direction = 'OUT')
                AS csv_unique_outgoing,
            SUM(amount) FILTER (WHERE direction = 'IN')
                AS csv_incoming_amount,
            SUM(amount) FILTER (WHERE direction = 'OUT')
                AS csv_outgoing_amount
        FROM flows
        GROUP BY account_id
    """

    print("\nAggregating original CSV using DuckDB...")
    original = con.execute(query).fetchdf()
    con.close()

    # Normalize account IDs and compare
    features["_key"] = features["Account_ID"].astype(str).str.strip()
    original["_key"] = original["account_id"].astype(str).str.strip()

    merged = features.merge(
        original,
        on="_key",
        how="outer",
        indicator=True
    )

    only_parquet = (merged["_merge"] == "left_only").sum()
    only_csv = (merged["_merge"] == "right_only").sum()
    matched = (merged["_merge"] == "both").sum()

    print("\n===== ACCOUNT MATCHING =====")
    print(f"Matched accounts: {matched:,}")
    print(f"Only in Parquet: {only_parquet:,}")
    print(f"Only in CSV: {only_csv:,}")

    # Compare exact count and unique-counterparty features
    checks = {
        "Incoming_Count": "csv_incoming_count",
        "Outgoing_Count": "csv_outgoing_count",
        "Unique_Incoming_Senders": "csv_unique_incoming",
        "Unique_Outgoing_Receivers": "csv_unique_outgoing",
    }

    print("\n===== COUNT VALIDATION =====")
    total_mismatches = 0

    both = merged[merged["_merge"] == "both"]

    for feature_col, csv_col in checks.items():
        left = pd.to_numeric(both[feature_col], errors="coerce")
        right = pd.to_numeric(both[csv_col], errors="coerce")
        mismatch = (left != right).sum()
        total_mismatches += mismatch
        print(f"{feature_col} mismatches: {mismatch:,}")

    # Compare incoming and outgoing amount totals
    
    
    print("\n===== AMOUNT VALIDATION =====")

    amount_checks = {
        "Total_Incoming_Amount": "csv_incoming_amount",
        "Total_Outgoing_Amount": "csv_outgoing_amount",
    }

    for feature_col, csv_col in amount_checks.items():
        left = pd.to_numeric(
            both[feature_col], errors="coerce"
        ).fillna(0).to_numpy()

        right = pd.to_numeric(
            both[csv_col], errors="coerce"
        ).fillna(0).to_numpy()

        equal = np.isclose(
            left,
            right,
            rtol=1e-6,
            atol=0.01
        )

        mismatch_mask = ~equal
        mismatch_count = int(mismatch_mask.sum())
        total_mismatches += mismatch_count

        print(f"\n{feature_col} mismatches: {mismatch_count:,}")

        if mismatch_count > 0:
            diagnostic = both.loc[
                mismatch_mask, ["Account_ID"]
            ].copy()

            diagnostic["Parquet_Amount"] = left[mismatch_mask]
            diagnostic["CSV_Amount"] = right[mismatch_mask]

            diagnostic["Difference"] = (
                diagnostic["Parquet_Amount"]
                - diagnostic["CSV_Amount"]
            )

            diagnostic["Abs_Difference"] = (
                diagnostic["Difference"].abs()
            )

            print("\nLargest amount differences:")
            print(
                diagnostic.nlargest(
                    10, "Abs_Difference"
                )[
                    [
                        "Account_ID",
                        "Parquet_Amount",
                        "CSV_Amount",
                        "Difference",
                    ]
                ].to_string(index=False)
            )

            print(
                "\nMaximum absolute difference:",
                diagnostic["Abs_Difference"].max()
            )

    print("\n===== FINAL RESULT =====")
    print(f"Total feature mismatches: {total_mismatches:,}")

    if (
        only_parquet == 0
        and only_csv == 0
        and total_mismatches == 0
        and features["Account_ID"].isna().sum() == 0
        and features["Account_ID"].duplicated().sum() == 0
        and fan_in_mismatch == 0
        and fan_out_mismatch == 0
    ):
        print("PASS: Graph features match the original CSV.")
    else:
        print("CHECK: Differences found. Review the results above.")


if __name__ == "__main__":
    test_graph_features()