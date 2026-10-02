from pathlib import Path
import polars as pl

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"

final = pl.read_parquet(DATA / "final_account_risk_v3.parquet")
integrated = pl.read_parquet(DATA / "integrated_risk_features_v1.parquet")

print("\n--- FINAL RISK COLUMNS ---")
for col, dtype in final.schema.items():
    print(f"{col}: {dtype}")

print("\n--- REASON AND CONTRIBUTION COLUMNS ---")
selected = [
    c for c in final.columns
    if any(term in c.lower() for term in ["reason", "contrib", "signal", "risk_level"])
]
print(selected)

print("\n--- TOP PRIORITY ACCOUNTS WITH FINAL RISK DETAILS ---")
top_ids = (
    integrated.sort("Experimental_Investigation_Priority", descending=True)
    .select("Account_ID")
    .head(5)
)
details = top_ids.join(final, on="Account_ID", how="left")
display_cols = ["Account_ID"] + selected
display_cols = [c for c in display_cols if c in details.columns]
print(details.select(display_cols))

print("\nFinal risk audit completed.")
