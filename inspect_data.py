
import pyarrow.parquet as pq

files = [
    "data/processed/transaction_edges.parquet",
    "data/processed/account_graph_features.parquet",
]

for file in files:
    print(f"\n{'=' * 50}")
    print(f"FILE: {file}")

    try:
        parquet_file = pq.ParquetFile(file)

        print("Rows:", parquet_file.metadata.num_rows)
        print("Columns:", parquet_file.schema.names)
        print("Schema:")
        print(parquet_file.schema)

        # Read only the first 5 rows
        print("First 5 rows:")
        print(parquet_file.read_row_group(0).slice(0, 5).to_pandas())

    except Exception as e:
        print("Error:", repr(e))