
import polars as pl

base = "data/processed/"

final = pl.read_parquet(base + "final_account_risk_v3.parquet")
fan = pl.read_parquet(base + "fan_risk_scores.parquet")
graph = pl.read_parquet(base + "graph_risk_scores.parquet")
temporal = pl.read_parquet(base + "account_temporal_risk_v2.parquet")

# Standardize account IDs
final = final.with_columns(pl.col("Account_ID").cast(pl.String))
fan = fan.with_columns(pl.col("account_id").cast(pl.String))
graph = graph.with_columns(pl.col("account_id").cast(pl.String))
temporal = temporal.with_columns(pl.col("Account_ID").cast(pl.String))

# Select relevant score columns
data = final.select(["Account_ID", "Final_Risk_Score"])
data = data.join(
    fan.select(["account_id", "fan_risk_score"]),
    left_on="Account_ID", right_on="account_id", how="left"
)
data = data.join(
    graph.select(["account_id", "graph_risk_score"]),
    left_on="Account_ID", right_on="account_id", how="left"
)
data = data.join(
    temporal.select(["Account_ID", "Temporal_Risk_Score_V2"]),
    on="Account_ID", how="left"
)

print("Joined shape:", data.shape)
print("Missing values:")
print(data.null_count())

print("\nScore ranges:")
for col in [
    "Final_Risk_Score",
    "fan_risk_score",
    "graph_risk_score",
    "Temporal_Risk_Score_V2"
]:
    print(col, data.select(
        pl.col(col).min().alias("min"),
        pl.col(col).max().alias("max"),
        pl.col(col).mean().alias("mean")
    ).to_dicts())

print("\nCorrelations with existing final score:")
print(data.select([
    pl.corr("Final_Risk_Score", "fan_risk_score").alias("fan_corr"),
    pl.corr("Final_Risk_Score", "graph_risk_score").alias("graph_corr"),
    pl.corr("Final_Risk_Score", "Temporal_Risk_Score_V2").alias("temporal_corr")
]))