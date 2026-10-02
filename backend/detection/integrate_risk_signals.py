from pathlib import Path
import polars as pl

DATA = Path("data/processed")
OUTPUT = DATA / "integrated_risk_features_v1.parquet"

def load_score(filename, account_col, score_cols):
    df = pl.read_parquet(DATA / filename).select(
        pl.col(account_col).cast(pl.String).alias("Account_ID"),
        *[pl.col(c) for c in score_cols]
    )

    if df["Account_ID"].n_unique() != df.height:
        raise ValueError(f"Duplicate accounts in {filename}")

    if df.null_count().to_numpy().sum() > 0:
        raise ValueError(f"Null values found in {filename}")

    return df

fan = load_score(
    "fan_risk_scores.parquet",
    "account_id",
    ["fan_risk_score"]
)

graph = load_score(
    "graph_risk_scores.parquet",
    "account_id",
    ["graph_risk_score"]
)

temporal = load_score(
    "account_temporal_risk_v2.parquet",
    "Account_ID",
    ["Temporal_Risk_Score_V2"]
)

final = load_score(
    "final_account_risk_v3.parquet",
    "Account_ID",
    ["Final_Risk_Score"]
)

# Check that all files contain the same accounts.
base_ids = set(fan["Account_ID"].to_list())

for name, df in [
    ("graph", graph),
    ("temporal", temporal),
    ("final", final)
]:
    if set(df["Account_ID"].to_list()) != base_ids:
        raise ValueError(f"Account mismatch in {name} data")

# Join all risk signals by account.
merged = fan.join(graph, on="Account_ID", how="inner")
merged = merged.join(temporal, on="Account_ID", how="inner")
merged = merged.join(final, on="Account_ID", how="inner")

if merged.height != fan.height:
    raise ValueError("Unexpected row count after joins")

# Convert differently scaled scores to percentile ranks.
score_columns = {
    "fan_risk_score": "Fan_Risk_Percentile",
    "graph_risk_score": "Graph_Risk_Percentile",
    "Temporal_Risk_Score_V2": "Temporal_Risk_Percentile",
    "Final_Risk_Score": "Final_Risk_Percentile"
}

for source, target in score_columns.items():
    merged = merged.with_columns(
        (
            pl.col(source).rank(method="average")
            / merged.height * 100
        ).alias(target)
    )

# Equal-weight exploratory priority; not a fraud probability.
merged = merged.with_columns(
    pl.mean_horizontal(
        "Fan_Risk_Percentile",
        "Graph_Risk_Percentile",
        "Temporal_Risk_Percentile",
        "Final_Risk_Percentile"
    ).alias("Experimental_Investigation_Priority")
)

merged = merged.sort(
    "Experimental_Investigation_Priority",
    descending=True
)

merged.write_parquet(OUTPUT)

print("Integrated risk features generated.")
print("Rows:", merged.height)
print("Columns:", merged.columns)
print(merged.head(10))
print("Saved to:", OUTPUT)
