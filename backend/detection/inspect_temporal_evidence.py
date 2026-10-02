from pathlib import Path
import polars as pl
import json

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / "data" / "processed" / "account_temporal_risk_v2.parquet"

df = pl.read_parquet(FILE)

pl.Config.set_tbl_cols(20)
pl.Config.set_tbl_width_chars(300)

components = [
    "Pass_Through_Score",
    "Repeated_90_Score",
    "Rapid_Activity_Score",
    "Window_Consistency_Score",
    "Multi_Outgoing_Score",
]

print("\n--- COMPONENT MEANS ---")
print(df.select([
    pl.col(c).mean().alias(c) for c in components
]))

print("\n--- TOP 5 TEMPORAL ACCOUNTS WITH FULL EVIDENCE ---")
top = (
    df.sort("Temporal_Risk_Score_V2", descending=True)
    .select(
        ["Account_ID", "Temporal_Risk_Score_V2"]
        + components
        + [
            "Rapid_90_Signal",
            "Repeated_90_Signal",
            "Rapid_Activity_Signal",
            "Multi_Outgoing_Signal",
            "Temporal_Evidence",
        ]
    )
    .head(5)
)

for row in top.to_dicts():
    print(json.dumps(row, indent=2, default=str))

print("\nEvidence inspection completed.")
