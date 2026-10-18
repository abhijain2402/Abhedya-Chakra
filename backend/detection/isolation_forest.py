import numpy as np
import polars as pl
from sklearn.ensemble import IsolationForest


MODEL_FEATURES = [
    "fan_risk_score",
    "graph_risk_score",
    "Temporal_Risk_Score_V2",
    "Final_Risk_Score",
    "Incoming_Count",
    "Outgoing_Count",
    "Unique_Incoming_Senders",
    "Unique_Outgoing_Receivers",
    "L3_Signal_Transaction_Count",
    "Rapid_Pass_Through_Flag",
    "Collector_Pattern_Flag",
    "Distributor_Pattern_Flag",
    "Distributor_3_7_Fan_Out_Flag",
]


def add_isolation_forest_scores(accounts: pl.DataFrame) -> pl.DataFrame:
    """Add unsupervised anomaly scores without treating anomalies as fraud labels."""
    features = [column for column in MODEL_FEATURES if column in accounts.columns]
    if len(features) < 2:
        raise ValueError(
            "Isolation Forest requires at least two available numeric account features"
        )

    matrix = np.array(
        accounts.select(
            [pl.col(column).cast(pl.Float64, strict=False) for column in features]
        ).to_numpy(),
        dtype=np.float64,
        copy=True,
    )
    matrix[~np.isfinite(matrix)] = np.nan

    usable_columns = ~np.isnan(matrix).all(axis=0)
    matrix = matrix[:, usable_columns]
    if matrix.shape[1] < 2:
        raise ValueError(
            "Isolation Forest requires at least two non-empty numeric account features"
        )

    medians = np.nanmedian(matrix, axis=0)
    missing_rows, missing_columns = np.where(np.isnan(matrix))
    matrix[missing_rows, missing_columns] = medians[missing_columns]
    varying_columns = np.nanstd(matrix, axis=0) > 0
    matrix = matrix[:, varying_columns]
    if matrix.shape[1] < 2:
        raise ValueError(
            "Isolation Forest requires at least two varying account features"
        )

    model = IsolationForest(
        n_estimators=200,
        contamination="auto",
        random_state=42,
        n_jobs=-1,
    )
    predictions = model.fit_predict(matrix)
    return accounts.with_columns(
        pl.Series("Isolation_Forest_Score", model.score_samples(matrix)),
        pl.Series("Isolation_Forest_Anomaly", predictions == -1),
    )
