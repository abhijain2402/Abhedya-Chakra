
import polars as pl

path = "data/processed/final_account_risk_v3.parquet"
df = pl.read_parquet(path)

contributions = [
    "Account_Risk_Contribution",
    "Device_Risk_Contribution",
    "Payment_Risk_Contribution",
    "IP_Risk_Contribution",
    "Velocity_Risk_Contribution",
    "Anomaly_Risk_Contribution",
]

components = [
    "Account_Risk",
    "Device_Risk",
    "Payment_Risk",
    "IP_Risk_Score",
    "Velocity_Risk",
    "Anomaly_Risk",
]

# Check whether contribution sum matches final score
df = df.with_columns(
    pl.sum_horizontal(contributions).alias("Contribution_Sum")
).with_columns(
    (pl.col("Final_Risk_Score") - pl.col("Contribution_Sum"))
    .abs()
    .alias("Score_Difference")
)

print("Contribution validation:")
print(
    df.select(
        pl.col("Final_Risk_Score").mean().alias("Final_Mean"),
        pl.col("Contribution_Sum").mean().alias("Contribution_Mean"),
        pl.col("Score_Difference").max().alias("Max_Difference"),
        (pl.col("Score_Difference") < 0.01)
        .sum()
        .alias("Accounts_Matching")
    )
)

print("\nComponent ranges:")
for col in components + contributions:
    print(
        col,
        df.select(
            pl.col(col).min().alias("min"),
            pl.col(col).mean().alias("mean"),
            pl.col(col).max().alias("max")
        ).to_dicts()[0]
    )

print("\nRisk-level counts:")
print(df.group_by("Final_Risk_Level").len().sort("len", descending=True))