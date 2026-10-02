import polars as pl

files = [
    "data/processed/fan_risk_scores.parquet",
    "data/processed/graph_risk_scores.parquet"
]

for file in files:
    df = pl.read_parquet(file)

    print(f"\n{'='*50}")
    print(file)
    print("Shape:", df.shape)
    print("Columns:", df.columns)
    print("Schema:", df.schema)
    print(df.head(5))
    
import polars as pl

fan = pl.read_parquet(
    "data/processed/fan_risk_scores.parquet"
)

graph = pl.read_parquet(
    "data/processed/graph_risk_scores.parquet"
)

print("Fan duplicate IDs:", fan["account_id"].is_duplicated().sum())
print("Graph duplicate IDs:", graph["account_id"].is_duplicated().sum())

print("Fan score stats:")
print(fan.select(
    pl.col("fan_risk_score").min().alias("min"),
    pl.col("fan_risk_score").max().alias("max"),
    pl.col("fan_risk_score").mean().alias("mean"),
    pl.col("fan_risk_score").null_count().alias("nulls")
))

print("Graph score stats:")
print(graph.select(
    pl.col("graph_risk_score").min().alias("min"),
    pl.col("graph_risk_score").max().alias("max"),
    pl.col("graph_risk_score").mean().alias("mean"),
    pl.col("graph_risk_score").null_count().alias("nulls")
))

print("Fan IDs missing in graph:", 
      fan.join(graph, on="account_id", how="anti").height)

print("Graph IDs missing in fan:",
      graph.join(fan, on="account_id", how="anti").height)