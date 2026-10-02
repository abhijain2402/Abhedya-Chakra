
from pathlib import Path
import polars as pl

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "data" / "processed" / "transaction_edges_rebuilt.parquet"

df = pl.scan_parquet(path)

duplicates = (
    df.group_by("Transaction_ID")
    .agg(
        pl.len().alias("occurrences"),
        pl.col("Sender_Account").n_unique().alias("senders"),
        pl.col("Receiver_Account").n_unique().alias("receivers"),
        pl.col("Amount").n_unique().alias("amounts"),
        pl.col("Timestamp").n_unique().alias("timestamps"),
    )
    .filter(pl.col("occurrences") > 1)
    .sort("occurrences", descending=True)
    .collect()
)

print("Duplicate transaction IDs:", duplicates.height)
print("Extra occurrences:", duplicates["occurrences"].sum() - duplicates.height)
print("\nDuplicate ID summary:")
print(duplicates.head(15))

print("\nSample duplicate transaction records:")
duplicate_ids = duplicates.head(10).select("Transaction_ID")
sample = (
    df.join(duplicate_ids.lazy(), on="Transaction_ID", how="inner")
    .sort("Transaction_ID")
    .collect()
)
print(sample)