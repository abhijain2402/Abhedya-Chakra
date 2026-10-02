
import polars as pl
import polars.selectors as cs

# Temporal risk Parquet file
file_path = "data/processed/account_temporal_risk_v2.parquet"

try:
    # Read Parquet file
    df = pl.read_parquet(file_path)

    # ==========================================
    # 1. BASIC INFORMATION
    # ==========================================
    print("\n===== BASIC INFORMATION =====")
    print("Rows:", df.height)
    print("Columns:", df.width)
    print("\nSchema:")
    print(df.schema)

    # ==========================================
    # 2. NULL VALUE CHECK
    # ==========================================
    print("\n===== NULL VALUES =====")
    nulls = df.null_count()
    print(nulls)

    total_nulls = sum(nulls.row(0))
    print("Total null values:", total_nulls)

    # ==========================================
    # 3. ACCOUNT ID VALIDATION
    # ==========================================
    print("\n===== ACCOUNT ID CHECK =====")

    if "Account_ID" not in df.columns:
        raise ValueError("Account_ID column not found!")

    unique_accounts = df["Account_ID"].n_unique()
    duplicate_ids = df.height - unique_accounts
    null_ids = df["Account_ID"].null_count()

    print("Total accounts:", df.height)
    print("Unique accounts:", unique_accounts)
    print("Duplicate IDs:", duplicate_ids)
    print("Null IDs:", null_ids)

    if duplicate_ids == 0 and null_ids == 0:
        print("PASS: Account IDs are unique.")
    else:
        print("CHECK: Duplicate or null Account IDs found.")

    # ==========================================
    # 4. NUMERIC SUMMARY
    # ==========================================
    print("\n===== NUMERIC SUMMARY =====")
    print(df.select(cs.numeric()).describe())

    # ==========================================
    # 5. RISK SCORE VALIDATION
    # ==========================================
    print("\n===== RISK SCORE CHECK =====")

    score_cols = [
        "Temporal_Risk_Score_V2",
        "Pass_Through_Score",
        "Repeated_90_Score",
        "Rapid_Activity_Score",
        "Window_Consistency_Score",
        "Multi_Outgoing_Score"
    ]

    for col in score_cols:
        if col not in df.columns:
            print(f"{col}: COLUMN MISSING")
            continue

        series = df[col]

        print(f"\n{col}")
        print("Min:", series.min())
        print("Max:", series.max())
        print("Negative values:", (series < 0).sum())
        print("Infinite/NaN values:", (~series.is_finite()).sum())

        if (series < 0).sum() > 0:
            print("CHECK: Negative scores found.")
        elif (~series.is_finite()).sum() > 0:
            print("CHECK: Non-finite scores found.")
        else:
            print("PASS: No negative or non-finite scores.")

    # ==========================================
    # 6. SIGNAL VALIDATION
    # ==========================================
    print("\n===== SIGNAL COUNTS =====")

    signal_cols = [
        "Rapid_90_Signal",
        "Repeated_90_Signal",
        "Rapid_Activity_Signal",
        "Multi_Outgoing_Signal"
    ]

    for col in signal_cols:
        if col in df.columns:
            print(f"\n{col}")
            print(df[col].value_counts())
        else:
            print(f"{col}: COLUMN MISSING")

    # ==========================================
    # 7. TEMPORAL EVIDENCE VALIDATION
    # ==========================================
    print("\n===== TEMPORAL EVIDENCE =====")

    if "Temporal_Evidence" in df.columns:
        empty_evidence = df.filter(
            pl.col("Temporal_Evidence").list.len() == 0
        ).height

        print("Empty evidence lists:", empty_evidence)

        evidence_type = df.schema["Temporal_Evidence"]
        print("Evidence data type:", evidence_type)
    else:
        print("Temporal_Evidence column missing.")

    # ==========================================
    # 8. CROSS-FILE ACCOUNT ID VALIDATION
    # ==========================================
    print("\n===== CROSS-FILE ID VALIDATION =====")
    
    other_files = {
        "account_graph_features": (
            "data/processed/account_graph_features.parquet",
            "Account_ID"
        ),
        "fan_risk_scores": (
            "data/processed/fan_risk_scores.parquet",
            "account_id"
        ),
        "graph_risk_scores": (
            "data/processed/graph_risk_scores.parquet",
            "account_id"
        ),
        "risk_signals_merged": (
            "data/processed/risk_signals_merged.parquet",
            "account_id"
        )
    }
    
    temporal_ids = set(
        df["Account_ID"].drop_nulls().to_list()
    )

    for name, (path, id_col) in other_files.items():
        try:
            other = pl.read_parquet(path, columns=[id_col])

            other_ids = set(
                other[id_col].drop_nulls().to_list()
            )

            missing_in_other = temporal_ids - other_ids
            missing_in_temporal = other_ids - temporal_ids

            print(f"\n{name}")
            print("Accounts in file:", len(other_ids))
            print("Missing from other file:", len(missing_in_other))
            print("Missing from temporal file:", len(missing_in_temporal))

            if (
                len(missing_in_other) == 0
                and len(missing_in_temporal) == 0
            ):
                print("PASS: Account IDs match.")
            else:
                print("CHECK: Account ID mismatch found.")

                if missing_in_other:
                    print("Sample missing IDs:", list(missing_in_other)[:5])

                if missing_in_temporal:
                    print("Sample extra IDs:", list(missing_in_temporal)[:5])

        except Exception as e:
            print(f"\n{name}: VALIDATION FAILED - {e}")

    # ==========================================
    # 9. FINAL BASIC VALIDATION
    # ==========================================
    print("\n===== FINAL VALIDATION SUMMARY =====")

    print("File readable: PASS")
    print("Rows:", df.height)
    print("Columns:", df.width)
    print("Total null values:", total_nulls)
    print("Duplicate Account IDs:", duplicate_ids)
    print("Null Account IDs:", null_ids)

    if (
        df.height > 0
        and df.width > 0
        and total_nulls == 0
        and duplicate_ids == 0
        and null_ids == 0
    ):
        print("\nPASS: Basic structural validation successful.")
    else:
        print("\nCHECK: Basic validation issues found.")

except Exception as e:
    print("\nVALIDATION FAILED:", e)
