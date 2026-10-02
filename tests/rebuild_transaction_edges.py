
from pathlib import Path
import polars as pl
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]

CSV_FILE = ROOT / "VoidHacks8_MuleAccount_2M_Transactions.csv"
OUTPUT_FILE = ROOT / "data" / "processed" / "transaction_edges_rebuilt.parquet"

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

if not CSV_FILE.exists():
    raise FileNotFoundError(f"CSV not found: {CSV_FILE}")

if OUTPUT_FILE.exists():
    raise FileExistsError(
        f"Output already exists: {OUTPUT_FILE}. "
        "Rename or inspect it before rebuilding."
    )

print("Reading source CSV...")
df = pl.scan_csv(
    CSV_FILE,
    infer_schema_length=10000,
    try_parse_dates=False
)

required_columns = [
    "Transaction_ID",
    "Sender_Account",
    "Receiver_Account",
    "Sender_IFSC",
    "Receiver_IFSC",
    "Amount",
    "Timestamp",
    "Payment_Mode",
    "Narration",
    "IP_Address",
    "Device_Type",
]

schema = df.collect_schema()
missing = [col for col in required_columns if col not in schema]

if missing:
    raise ValueError(f"Missing columns in CSV: {missing}")

print("Writing rebuilt Parquet...")
df.select(required_columns).sink_parquet(
    OUTPUT_FILE,
    compression="zstd",
    maintain_order=True
)

print("Validating output...")
parquet = pq.ParquetFile(OUTPUT_FILE)

print("Rows:", f"{parquet.metadata.num_rows:,}")
print("Columns:", parquet.schema.names)
print("File size:", f"{OUTPUT_FILE.stat().st_size:,} bytes")

# Confirm it can be read
check = pl.scan_parquet(OUTPUT_FILE)
print("Schema:", check.collect_schema())
print("Sample:")
print(check.head(5).collect())

print("SUCCESS: Rebuilt Parquet is readable.")