@'
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