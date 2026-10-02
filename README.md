# Abhedya Chakra
### Explainable Mule-Account Risk Analysis & Digital Fund Tracing

Abhedya Chakra is a transaction-analysis project designed to help investigators identify potentially suspicious account activity, analyze risk signals, and explore chronological transaction paths across accounts.

The system focuses on explainable, evidence-based investigation rather than automatically declaring an account fraudulent.

## Problem Statement

Large transaction networks can make it difficult to identify potentially suspicious account activity and follow the movement of funds between accounts.

Abhedya Chakra analyzes transaction-level and account-level patterns to help prioritize accounts for further investigation and trace possible transaction paths.

## Key Features

### 1. Account Risk Analysis
- Account-level risk feature analysis.
- Fan-in and fan-out pattern analysis.
- Graph-based risk signals.
- Temporal activity and risk analysis.
- Integration of multiple risk signals into an experimental investigation-priority score.

### 2. Fan Pattern Detection
- Analyzes incoming and outgoing transaction patterns.
- Calculates fan metrics.
- Identifies account patterns that may require further investigation.

### 3. Graph Risk Analysis
- Uses account transaction relationships to derive graph-based risk signals.
- Helps identify potentially relevant accounts within a transaction network.

### 4. Temporal Risk Analysis
- Examines transaction activity over time.
- Supports investigation of unusual account activity patterns.

### 5. Rapid Pass-Through Analysis
- Identifies candidate rapid pass-through transaction patterns for further review.

### 6. Chronological Fund Tracing
- Traces candidate transaction paths from a selected root account.
- Supports a maximum depth of 4 hops.
- Uses chronological transaction ordering.
- Prevents repeated accounts within a path.
- Exports candidate paths with transaction details.

### 7. Investigation Summary
- Generates a readable CSV summary of candidate paths.
- Includes account flow, hop count, transaction IDs, amounts, and timestamps.

## Project Workflow

```text
Transaction Dataset
        |
        v
Data Inspection & Integrity Checks
        |
        v
Feature Engineering
        |
        +-------------------+
        |                   |
        v                   v
   Fan Analysis        Temporal Analysis
        |                   |
        v                   |
   Graph Analysis           |
        |                   |
        +---------+---------+
                  |
                  v
         Risk Signal Analysis
                  |
                  v
       Investigation Prioritization
                  |
                  v
        Chronological Fund Tracing
                  |
                  v
        Investigation CSV Reports
```

## Reproducing the Backend

Use Python 3.11 or newer and install the pinned dependencies:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Large source and generated data files are intentionally not stored in Git. To rebuild the fund-tracing input, place `VoidHacks8_MuleAccount_2M_Transactions.csv` in the project root, then run:

```powershell
python tests/rebuild_transaction_edges.py
python tests/add_source_row_id.py
```

The API also requires `data/processed/integrated_risk_features_v1.parquet`. It can be assembled with `python backend/detection/integrate_risk_signals.py` after providing `fan_risk_scores.parquet`, `graph_risk_scores.parquet`, `account_temporal_risk_v2.parquet`, and `final_account_risk_v3.parquet` in `data/processed/`. The upstream steps that produce those four score files are not included in this repository, so the risk-scoring data pipeline is not fully reproducible from this repository alone.

Once the required data files are in place, start the API with:

```powershell
python -m uvicorn backend.api.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the interactive API documentation.