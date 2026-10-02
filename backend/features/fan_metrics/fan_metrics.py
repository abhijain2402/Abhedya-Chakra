
from pathlib import Path
import pandas as pd

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[3]

INPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "account_graph_features.parquet"
)

OUTPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "fan_metrics.parquet"
)

# Features required for fan-in / fan-out
REQUIRED_COLUMNS = [
    "Account_ID",
    "Unique_Incoming_Senders",
    "Unique_Outgoing_Receivers",
    "Total_Incoming_Amount",
    "Total_Outgoing_Amount",
]


def calculate_fan_metrics():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}"
        )

    # Load teammate's processed account features
    df = pd.read_parquet(INPUT_FILE)

    # Validate required columns
    missing = [
        col for col in REQUIRED_COLUMNS
        if col not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    # Keep only relevant data
    result = df[REQUIRED_COLUMNS].copy()

    # Fan-in: number of unique incoming senders
    result["Fan_In"] = (
        pd.to_numeric(
            result["Unique_Incoming_Senders"],
            errors="coerce"
        )
        .fillna(0)
        .astype("int64")
    )

    # Fan-out: number of unique outgoing receivers
    result["Fan_Out"] = (
        pd.to_numeric(
            result["Unique_Outgoing_Receivers"],
            errors="coerce"
        )
        .fillna(0)
        .astype("int64")
    )

    # Total unique connections
    result["Total_Fan_Degree"] = (
        result["Fan_In"] + result["Fan_Out"]
    )

    # Avoid division by zero
    result["Fan_Out_In_Degree_Ratio"] = (
        result["Fan_Out"]
        / result["Fan_In"].replace(0, float("nan"))
    )

    # Check existing fan values, if available
    if "Fan_In" in df.columns:
        old_fan_in = pd.to_numeric(
            df["Fan_In"], errors="coerce"
        ).fillna(0)

        mismatch = (old_fan_in != result["Fan_In"]).sum()
        print(f"Fan-in mismatches: {mismatch}")

    if "Fan_Out" in df.columns:
        old_fan_out = pd.to_numeric(
            df["Fan_Out"], errors="coerce"
        ).fillna(0)

        mismatch = (old_fan_out != result["Fan_Out"]).sum()
        print(f"Fan-out mismatches: {mismatch}")

    # Save calculated features
    result.to_parquet(OUTPUT_FILE, index=False)

    print("\nFan metrics generated successfully!")
    print(f"Total accounts: {len(result)}")
    print(f"Output: {OUTPUT_FILE}")
    print("\nSample records:")
    print(
        result[
            [
                "Account_ID",
                "Fan_In",
                "Fan_Out",
                "Total_Fan_Degree",
                "Fan_Out_In_Degree_Ratio",
            ]
        ].head(5).to_string(index=False)
    )


if __name__ == "__main__":
    calculate_fan_metrics()