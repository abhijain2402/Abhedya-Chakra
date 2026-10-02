
import polars as pl

base = "data/processed/"

final = pl.read_parquet(base + "final_account_risk_v3.parquet")
fan = pl.read_parquet(base + "fan_risk_scores.parquet")
graph = pl.read_parquet(base + "graph_risk_scores.parquet")
temporal = pl.read_parquet(base + "account_temporal_risk_v2.parquet")

df = final.select(["Account_ID", "Final_Risk_Score"]).join(
    fan.select(["account_id", "fan_risk_score"]),
    left_on="Account_ID", right_on="account_id", how="left"
).join(
    graph.select(["account_id", "graph_risk_score"]),
    left_on="Account_ID", right_on="account_id", how="left"
).join(
    temporal.select(["Account_ID", "Temporal_Risk_Score_V2"]),
    on="Account_ID", how="left"
)

# Convert scores to percentile ranks (0–100)
score_cols = {
    "Final_Risk_Score": "base_pct",
    "fan_risk_score": "fan_pct",
    "graph_risk_score": "graph_pct",
    "Temporal_Risk_Score_V2": "temporal_pct",
}

df = df.with_columns([
    (pl.col(source).rank(method="average") / pl.len() * 100)
    .alias(target)
    for source, target in score_cols.items()
])

# Provisional weights for an experimental score
df = df.with_columns(
    (
        pl.col("base_pct") * 0.70
        + pl.col("fan_pct") * 0.10
        + pl.col("graph_pct") * 0.10
        + pl.col("temporal_pct") * 0.10
    ).alias("Experimental_Fused_Risk_Score")
)

output = df.select([
    "Account_ID",
    "Final_Risk_Score",
    "fan_risk_score",
    "graph_risk_score",
    "Temporal_Risk_Score_V2",
    "Experimental_Fused_Risk_Score",
]).sort("Experimental_Fused_Risk_Score", descending=True)

output.write_parquet(
    base + "experimental_fused_risk_v1.parquet"
)

print("Saved experimental fused risk score.")
print("\nTop 20 accounts:")
print(output.head(20))
print("\nScore summary:")
print(output.select(
    pl.col("Experimental_Fused_Risk_Score").min().alias("min"),
    pl.col("Experimental_Fused_Risk_Score").mean().alias("mean"),
    pl.col("Experimental_Fused_Risk_Score").max().alias("max"),
))