
import polars as pl

fan = pl.read_parquet(
    "data/processed/fan_risk_scores.parquet"
).select([
    "account_id",
    "fan_risk_score"
])

graph = pl.read_parquet(
    "data/processed/graph_risk_scores.parquet"
).select([
    "account_id",
    "graph_risk_score"
])

# Merge using account ID
merged = fan.join(
    graph,
    on="account_id",
    how="inner"
)

# Validate merged data
assert merged.height == 24873
assert merged["account_id"].n_unique() == merged.height
assert merged["fan_risk_score"].null_count() == 0
assert merged["graph_risk_score"].null_count() == 0

# Save as a new file
merged.write_parquet(
    "data/processed/risk_signals_merged.parquet"
)

print("Risk signals merged successfully!")
print("Shape:", merged.shape)
print(merged.head(5))