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