
import polars as pl

path = "data/processed/final_account_risk_v3.parquet"

df = pl.read_parquet(path)

print("===== BASIC INFO =====")
print("Shape:", df.shape)
print("Columns:", df.columns)
print("\nSchema:")
print(df.schema)

print("\n===== FIRST 10 ROWS =====")
print(df.head(10))

print("\n===== NULL VALUES =====")
print(df.null_count())

print("\n===== DUPLICATE ACCOUNT IDS =====")
for col in ["Account_ID", "account_id"]:
    if col in df.columns:
        print("Account ID column:", col)
        print("Unique:", df[col].n_unique())
        print("Duplicates:", df.height - df[col].n_unique())
        break

print("\n===== NUMERIC SUMMARY =====")
print(df.select(pl.selectors.numeric()).describe())