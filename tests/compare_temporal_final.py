import polars as pl

base = "data/processed/"
temporal = pl.read_parquet(base + "account_temporal_risk_v2.parquet")
final = pl.read_parquet(base + "final_account_risk_v3.parquet")

accounts = [
    "BARB10000368",
    "HDFC10000429",
    "PYTM10000318",
    "PUNB10000370",
    "BARB10000427",
    "IPOS10017593",
    "SBIN10005204",
    "KKBK10017961",
    "PUNB10014709",
    "HDFC10005362",
]

print("FINAL RISK COLUMNS:")
print(final.columns)

final_cols = [
    c for c in [
        "Account_ID", "Final_Risk_Score", "Risk_Level",
        "Account_Risk", "Device_Risk", "Payment_Risk",
        "IP_Risk_Score", "Velocity_Risk", "Anomaly_Risk",
        "Reasons"
    ] if c in final.columns
]

temp_cols = [
    c for c in [
        "Account_ID", "Temporal_Risk_Score_V2",
        "Pass_Through_Score", "Repeated_90_Score",
        "Rapid_Activity_Score", "Window_Consistency_Score",
        "Multi_Outgoing_Score", "Rapid_90_Signal",
        "Repeated_90_Signal", "Rapid_Activity_Signal",
        "Multi_Outgoing_Signal", "Temporal_Evidence"
    ] if c in temporal.columns
]

joined = temporal.select(temp_cols).join(
    final.select(final_cols),
    on="Account_ID",
    how="inner"
)

print("\n--- ACCOUNT-WISE TEMPORAL VS FINAL RISK ---")
print(
    joined.filter(pl.col("Account_ID").is_in(accounts))
    .sort("Temporal_Risk_Score_V2", descending=True)
    .to_dicts()
)

print("\nMatched accounts:", joined.height)
