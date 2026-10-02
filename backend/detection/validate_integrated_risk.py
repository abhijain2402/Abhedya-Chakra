from pathlib import Path
import polars as pl
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / "data" / "processed" / "integrated_risk_features_v1.parquet"

df = pl.read_parquet(FILE)

scores = [
    "fan_risk_score",
    "graph_risk_score",
    "Temporal_Risk_Score_V2",
    "Final_Risk_Score",
    "Experimental_Investigation_Priority",
]

print("\n--- BASIC VALIDATION ---")
print("Rows:", df.height)
print("Unique accounts:", df["Account_ID"].n_unique())
print("Null counts:")
print(df.select([pl.col(c).null_count().alias(c) for c in scores]))

print("\n--- SCORE STATISTICS ---")
print(df.select([
    pl.col(c).min().alias(f"{c}_min") for c in scores
] + [
    pl.col(c).mean().alias(f"{c}_mean") for c in scores
] + [
    pl.col(c).max().alias(f"{c}_max") for c in scores
]))

print("\n--- INVESTIGATION PRIORITY GROUPS ---")
priority = "Experimental_Investigation_Priority"
groups = df.with_columns(
    pl.when(pl.col(priority) >= 95).then(pl.lit("95-100"))
    .when(pl.col(priority) >= 90).then(pl.lit("90-95"))
    .when(pl.col(priority) >= 75).then(pl.lit("75-90"))
    .otherwise(pl.lit("Below 75"))
    .alias("Priority_Range")
)
print(
    groups.group_by("Priority_Range")
    .agg(pl.len().alias("Account_Count"))
    .sort("Priority_Range")
)

print("\n--- CORRELATION BETWEEN RISK SIGNALS ---")
corr_cols = scores[:4]
matrix = np.corrcoef(df.select(corr_cols).to_numpy(), rowvar=False)
print(pl.DataFrame(
    matrix,
    schema=corr_cols,
    orient="row"
).with_columns(pl.Series("Signal", corr_cols)).select(
    ["Signal"] + corr_cols
))

print("\n--- TOP 10 ACCOUNTS ---")
print(
    df.sort(priority, descending=True)
    .select(["Account_ID"] + scores)
    .head(10)
)

print("\nValidation report completed.")
