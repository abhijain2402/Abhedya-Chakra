
from pathlib import Path
import polars as pl

ROOT = Path(__file__).resolve().parents[1]

source = ROOT / "data" / "processed" / "transaction_edges_rebuilt.parquet"
output = ROOT / "data" / "processed" / "transaction_edges_with_row_id.parquet"

if output.exists():
    raise FileExistsError(f"Output already exists: {output}")

df = (
    pl.scan_parquet(source)
    .with_row_index("Source_Row_ID", offset=1)
)

df.sink_parquet(output, compression="zstd")

check = pl.scan_parquet(output)
print("Rows:", check.select(pl.len()).collect().item())
print("Unique row IDs:", check.select(pl.col("Source_Row_ID").n_unique()).collect().item())
print("Schema:", check.collect_schema())
print("SUCCESS: Unique internal row IDs added.")