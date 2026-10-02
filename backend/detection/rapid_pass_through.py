
from collections import deque
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data" / "processed" / "transaction_edges_with_row_id.parquet"
OUTPUT = ROOT / "data" / "processed" / "rapid_pass_through_candidates_v2.parquet"

if OUTPUT.exists():
    raise FileExistsError(f"Output already exists: {OUTPUT}")

MIN_AGE_NS = 3 * 60 * 1_000_000_000
MAX_AGE_NS = 15 * 60 * 1_000_000_000
THRESHOLD = 0.90

print("Loading transaction data...")
tx = pd.read_parquet(
    INPUT,
    columns=[
        "Source_Row_ID", "Transaction_ID",
        "Sender_Account", "Receiver_Account",
        "Amount", "Timestamp",
    ],
)

tx["Timestamp"] = pd.to_datetime(tx["Timestamp"], errors="coerce")
tx["Amount"] = pd.to_numeric(tx["Amount"], errors="coerce")
tx = tx.dropna(
    subset=["Timestamp", "Amount", "Sender_Account", "Receiver_Account"]
)
tx = tx[tx["Amount"] > 0]
tx = tx[tx["Sender_Account"] != tx["Receiver_Account"]].copy()
tx["ts_ns"] = tx["Timestamp"].astype("int64")
tx.reset_index(drop=True, inplace=True)

incoming_groups = tx.groupby("Receiver_Account", sort=False).indices
outgoing_groups = tx.groupby("Sender_Account", sort=False).indices
accounts = set(incoming_groups) | set(outgoing_groups)

candidates = []
print(f"Processing {len(accounts):,} accounts...")

for account in accounts:
    in_idx = incoming_groups.get(account, [])
    out_idx = outgoing_groups.get(account, [])

    incoming = tx.iloc[in_idx][
        ["Source_Row_ID", "Transaction_ID", "Timestamp", "ts_ns", "Amount"]
    ].copy()
    incoming["Direction"] = "IN"

    outgoing = tx.iloc[out_idx][
        ["Source_Row_ID", "Transaction_ID", "Timestamp", "ts_ns", "Amount"]
    ].copy()
    outgoing["Direction"] = "OUT"

    events = pd.concat([incoming, outgoing], ignore_index=True)
    events.sort_values(
        ["ts_ns", "Source_Row_ID"], kind="stable", inplace=True
    )

    # Lot: [row_id, tx_id, timestamp_ns, amount, remaining,
    #       attributed_out, eligible_out_count]
    lots = deque()
    all_lots = []

    for e in events.itertuples(index=False):
        row_id = int(e.Source_Row_ID)
        amount = float(e.Amount)
        ts_ns = int(e.ts_ns)

        if e.Direction == "IN":
            lot = [
                row_id, e.Transaction_ID, ts_ns,
                amount, amount, 0.0, 0,
            ]
            lots.append(lot)
            all_lots.append(lot)
            continue

        remaining_out = amount

        while remaining_out > 1e-9 and lots:
            lot = lots[0]
            allocated = min(remaining_out, lot[4])
            age = ts_ns - lot[2]

            if MIN_AGE_NS <= age <= MAX_AGE_NS:
                lot[5] += allocated
                lot[6] += 1

            lot[4] -= allocated
            remaining_out -= allocated

            if lot[4] <= 1e-9:
                lots.popleft()

    for lot in all_lots:
        row_id, tx_id, ts_ns, original, _, attributed, out_count = lot
        ratio = attributed / original if original > 0 else 0

        if ratio >= THRESHOLD and out_count > 0:
            candidates.append({
                "Account_ID": account,
                "Source_Row_ID": row_id,
                "Transaction_ID": tx_id,
                "Incoming_Timestamp": pd.to_datetime(ts_ns),
                "Incoming_Amount": original,
                "Outgoing_Amount_3_to_15m": attributed,
                "Outgoing_Transaction_Count": out_count,
                "Outgoing_Incoming_Ratio": ratio,
                "Pass_Through_Flag": True,
            })

print("Saving candidate evidence...")
result = pd.DataFrame(candidates)

if result.empty:
    print("No transactions met the screening threshold.")
else:
    result.sort_values(
        ["Outgoing_Incoming_Ratio", "Incoming_Amount"],
        ascending=[False, False],
        inplace=True,
    )
    result.to_parquet(OUTPUT, index=False, compression="zstd")
    print(f"Candidate events: {len(result):,}")
    print(f"Candidate accounts: {result['Account_ID'].nunique():,}")
    print(f"Output: {OUTPUT}")

print("Completed. Screening only; not a confirmed mule label.")