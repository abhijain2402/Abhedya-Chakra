from pathlib import Path
import polars as pl
import json

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

integrated = pl.read_parquet(DATA / "integrated_risk_features_v1.parquet")
final = pl.read_parquet(DATA / "final_account_risk_v3.parquet")
temporal = pl.read_parquet(DATA / "account_temporal_risk_v2.parquet")

top_ids = (
    integrated.sort("Experimental_Investigation_Priority", descending=True)
    .select("Account_ID")
    .head(5)
)

details = (
    top_ids
    .join(integrated, on="Account_ID", how="left")
    .join(final, on="Account_ID", how="left")
    .join(temporal, on="Account_ID", how="left")
)

columns = [
    "Account_ID",
    "Experimental_Investigation_Priority",
    "Final_Risk_Score",
    "Final_Risk_Level",
    "Risk_Reasons",
    "Calibrated_Device_Risk_Level",
    "Calibrated_Device_Risk_Reasons",
    "Velocity_Risk_Level",
    "Velocity_Risk_Reasons",
    "Account_Risk_Contribution",
    "Device_Risk_Contribution",
    "Payment_Risk_Contribution",
    "IP_Risk_Contribution",
    "Velocity_Risk_Contribution",
    "Anomaly_Risk_Contribution",
    "Temporal_Risk_Score_V2",
    "Temporal_Evidence",
]

columns = [c for c in columns if c in details.columns]

print("\n--- FULL RISK REASONS FOR TOP 5 ---")
for row in details.select(columns).to_dicts():
    print(json.dumps(row, indent=2, default=str, ensure_ascii=False))

print("\nFull risk reason inspection completed.")
