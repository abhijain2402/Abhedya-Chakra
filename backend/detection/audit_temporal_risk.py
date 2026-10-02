from pathlib import Path
import polars as pl

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

temporal = pl.read_parquet(DATA / "account_temporal_risk_v2.parquet")
final = pl.read_parquet(DATA / "final_account_risk_v3.parquet")

components = [
    "Pass_Through_Score",
    "Repeated_90_Score",
    "Rapid_Activity_Score",
    "Window_Consistency_Score",
    "Multi_Outgoing_Score",
]

components = [c for c in components if c in temporal.columns]
bool_cols = [
    c for c, dtype in temporal.schema.items()
    if dtype == pl.Boolean and c != "Account_ID"
]
evidence_col = "Temporal_Evidence" if "Temporal_Evidence" in temporal.columns else None

print("\n--- TEMPORAL DATA ---")
print("Rows:", temporal.height)
print("Unique accounts:", temporal["Account_ID"].n_unique())
print("Columns:", temporal.columns)

print("\n--- TEMPORAL SCORE STATISTICS ---")
print(temporal.select([
    pl.col("Temporal_Risk_Score_V2").min().alias("min"),
    pl.col("Temporal_Risk_Score_V2").mean().alias("mean"),
    pl.col("Temporal_Risk_Score_V2").median().alias("median"),
    pl.col("Temporal_Risk_Score_V2").max().alias("max"),
]))

if components:
    print("\n--- COMPONENT STATISTICS ---")
    print(temporal.select([
        pl.col(c).min().alias(f"{c}_min") for c in components
    ] + [
        pl.col(c).mean().alias(f"{c}_mean") for c in components
    ] + [
        pl.col(c).max().alias(f"{c}_max") for c in components
    ]))

if bool_cols:
    print("\n--- BOOLEAN SIGNAL COUNTS ---")
    print(temporal.select([
        pl.col(c).sum().alias(c) for c in bool_cols
    ]))

print("\n--- HIGHEST TEMPORAL RISK ACCOUNTS ---")
top_cols = ["Account_ID", "Temporal_Risk_Score_V2"] + components + bool_cols
if evidence_col:
    top_cols.append(evidence_col)
print(
    temporal.sort("Temporal_Risk_Score_V2", descending=True)
    .select(top_cols)
    .head(10)
)

print("\n--- LOWEST TEMPORAL RISK ACCOUNTS ---")
print(
    temporal.sort("Temporal_Risk_Score_V2")
    .select(["Account_ID", "Temporal_Risk_Score_V2"] + components + bool_cols)
    .head(10)
)

print("\n--- TEMPORAL VS FINAL RISK ---")
joined = temporal.select(["Account_ID", "Temporal_Risk_Score_V2"]).join(
    final.select(["Account_ID", "Final_Risk_Score"]),
    on="Account_ID",
    how="inner"
)
print("Matched accounts:", joined.height)
print(
    "Correlation:",
    joined.select(
        pl.corr("Temporal_Risk_Score_V2", "Final_Risk_Score")
    ).item()
)

print("\nTemporal audit completed.")
