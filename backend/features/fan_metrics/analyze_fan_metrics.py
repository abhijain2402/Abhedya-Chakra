
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[3]

INPUT_FILE = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "fan_metrics.parquet"
)

df = pd.read_parquet(INPUT_FILE)

# Summary statistics
print("\n===== FAN-IN ANALYSIS =====")
print(df["Fan_In"].describe(
    percentiles=[0.50, 0.75, 0.90, 0.95, 0.99]
))

print("\n===== FAN-OUT ANALYSIS =====")
print(df["Fan_Out"].describe(
    percentiles=[0.50, 0.75, 0.90, 0.95, 0.99]
))

# Highest fan-in accounts
print("\n===== TOP 10 FAN-IN ACCOUNTS =====")
print(
    df.nlargest(10, "Fan_In")[
        ["Account_ID", "Fan_In", "Fan_Out"]
    ].to_string(index=False)
)

# Highest fan-out accounts
print("\n===== TOP 10 FAN-OUT ACCOUNTS =====")
print(
    df.nlargest(10, "Fan_Out")[
        ["Account_ID", "Fan_In", "Fan_Out"]
    ].to_string(index=False)
)