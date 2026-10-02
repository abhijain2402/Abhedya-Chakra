
from pathlib import Path
import pandas as pd

# ==============================
# 1. PROJECT PATHS
# ==============================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

INPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "fan_metrics.parquet"
)

OUTPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "fan_pattern_flags.parquet"
)

# ==============================
# 2. DETECTION THRESHOLDS
# ==============================

# Based on observed 99th percentiles
FAN_IN_THRESHOLD = 106.28
FAN_OUT_THRESHOLD = 107


# ==============================
# 3. FAN PATTERN DETECTION
# ==============================

def detect_fan_patterns():

    # Check input file
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}"
        )

    # Load fan metrics
    df = pd.read_parquet(INPUT_FILE)

    required_columns = [
        "Account_ID",
        "Fan_In",
        "Fan_Out",
    ]

    # Validate columns
    missing_columns = [
        col for col in required_columns
        if col not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing columns: {missing_columns}"
        )

    # Handle missing or invalid values
    df["Fan_In"] = (
        pd.to_numeric(df["Fan_In"], errors="coerce")
        .fillna(0)
    )

    df["Fan_Out"] = (
        pd.to_numeric(df["Fan_Out"], errors="coerce")
        .fillna(0)
    )

    # ==============================
    # 4. FAN-IN / FAN-OUT FLAGS
    # ==============================

    df["High_Fan_In_Flag"] = (
        df["Fan_In"] > FAN_IN_THRESHOLD
    )

    df["High_Fan_Out_Flag"] = (
        df["Fan_Out"] > FAN_OUT_THRESHOLD
    )

    # ==============================
    # 5. PATTERN CLASSIFICATION
    # ==============================

    df["Fan_Pattern"] = "Normal"

    # High Fan-In
    df.loc[
        df["High_Fan_In_Flag"]
        & ~df["High_Fan_Out_Flag"],
        "Fan_Pattern"
    ] = "High Fan-In"

    # High Fan-Out
    df.loc[
        ~df["High_Fan_In_Flag"]
        & df["High_Fan_Out_Flag"],
        "Fan_Pattern"
    ] = "High Fan-Out"

    # High Fan-In and Fan-Out
    df.loc[
        df["High_Fan_In_Flag"]
        & df["High_Fan_Out_Flag"],
        "Fan_Pattern"
    ] = "High Both"

    # ==============================
    # 6. PERCENTILE-BASED SCORES
    # ==============================

    # Relative percentile ranks (0-100)
    df["Fan_In_Percentile"] = (
        df["Fan_In"].rank(pct=True) * 100
    )

    df["Fan_Out_Percentile"] = (
        df["Fan_Out"].rank(pct=True) * 100
    )

    # Combined fan signal score
    # This is NOT a fraud probability
    df["Fan_Signal_Score"] = (
        df["Fan_In_Percentile"]
        + df["Fan_Out_Percentile"]
    ) / 2

    # ==============================
    # 7. SELECT OUTPUT COLUMNS
    # ==============================

    output_columns = [
        "Account_ID",
        "Fan_In",
        "Fan_Out",
        "Total_Fan_Degree",
        "Fan_Out_In_Degree_Ratio",
        "High_Fan_In_Flag",
        "High_Fan_Out_Flag",
        "Fan_Pattern",
        "Fan_In_Percentile",
        "Fan_Out_Percentile",
        "Fan_Signal_Score",
    ]

    # Keep only columns available in input or calculated
    output_columns = [
        col for col in output_columns
        if col in df.columns
    ]

    result = df[output_columns].copy()

    # ==============================
    # 8. SAVE RESULTS
    # ==============================

    result.to_parquet(
        OUTPUT_FILE,
        index=False
    )

    # ==============================
    # 9. DISPLAY SUMMARY
    # ==============================

    print("\n===== FAN PATTERN SUMMARY =====")

    print(
        result["Fan_Pattern"]
        .value_counts()
        .to_string()
    )

    flagged = result[
        result["Fan_Pattern"] != "Normal"
    ]

    print("\n===== FLAGGED ACCOUNTS =====")

    print(
        flagged[
            [
                "Account_ID",
                "Fan_In",
                "Fan_Out",
                "Fan_Pattern",
                "Fan_Signal_Score",
            ]
        ]
        .sort_values(
            "Fan_Signal_Score",
            ascending=False
        )
        .head(15)
        .to_string(index=False)
    )

    print("\n===== FAN SIGNAL SCORE SUMMARY =====")

    print(
        result["Fan_Signal_Score"]
        .describe()
        .to_string()
    )

    print("\n===== FINAL RESULTS =====")
    print(f"Total accounts: {len(result)}")
    print(f"Flagged candidates: {len(flagged)}")
    print(f"Output file: {OUTPUT_FILE}")

    print("\nFan pattern detection completed!")


# ==============================
# 10. RUN SCRIPT
# ==============================

if __name__ == "__main__":
    detect_fan_patterns()