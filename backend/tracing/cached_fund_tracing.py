import argparse
import csv
import time
from collections import defaultdict, deque
from pathlib import Path

import pyarrow.parquet as pq

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "transaction_edges_with_row_id.parquet"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
# Loaded once per process and reused by every trace.
_OUTGOING = None


def load_outgoing():
    global _OUTGOING
    if _OUTGOING is not None:
        return _OUTGOING

    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

    parquet_file = pq.ParquetFile(DATA_PATH)
    required = [
        "Transaction_ID", "Sender_Account", "Receiver_Account",
        "Amount", "Timestamp", "Source_Row_ID"
    ]
    missing = [col for col in required if col not in parquet_file.schema.names]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    outgoing = defaultdict(list)
    columns = required

    for batch in parquet_file.iter_batches(
        batch_size=100_000, columns=columns
    ):
        arrays = [batch.column(batch.schema.get_field_index(c)).to_pylist()
                  for c in columns]

        for txn, sender, receiver, amount, timestamp, row_id in zip(*arrays):
            if any(v is None for v in (txn, sender, receiver, amount, timestamp, row_id)):
                continue
            if sender == receiver:
                continue

            try:
                amount = float(amount)
                row_id = int(row_id)
            except (ValueError, TypeError, OverflowError):
                continue

            if amount <= 0:
                continue

            outgoing[str(sender)].append(
                (str(timestamp), row_id, str(txn), str(sender),
                 str(receiver), amount)
            )

    # Sort each account's outgoing transfers chronologically.
    for account in outgoing:
        outgoing[account].sort(key=lambda edge: (edge[0], edge[1]))

    _OUTGOING = outgoing
    return _OUTGOING


def trace_funds(root, outgoing, max_hops=4, max_outgoing=25, max_paths=1000):
    root = str(root)
    if root not in outgoing:
        return []

    # State: current account, path edges, visited accounts, last timestamp.
    queue = deque([(root, [], {root}, "")])
    found_paths = []

    while queue and len(found_paths) < max_paths:
        account, path, visited, last_timestamp = queue.popleft()
        hop = len(path)

        if hop >= max_hops:
            continue

        candidates = outgoing.get(account, [])
        considered = 0

        for edge in candidates:
            timestamp, row_id, txn, sender, receiver, amount = edge

            if last_timestamp and timestamp < last_timestamp:
                continue
            if receiver in visited:
                continue

            considered += 1
            if considered > max_outgoing:
                break

            new_path = path + [edge]
            found_paths.append(new_path)

            if len(found_paths) >= max_paths:
                break

            if hop + 1 < max_hops:
                queue.append((
                    receiver,
                    new_path,
                    visited | {receiver},
                    timestamp
                ))

    return found_paths


def save_paths(paths, account_id):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = "".join(c for c in str(account_id) if c.isalnum() or c in "-_")
    output_path = OUTPUT_DIR / f"fund_trace_cached_{safe_id}.csv"

    fields = [
        "Path_ID", "Hop", "Source_Row_ID", "Transaction_ID",
        "Sender_Account", "Receiver_Account", "Amount", "Timestamp"
    ]

    with output_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()

        for path_id, path in enumerate(paths, start=1):
            for hop, edge in enumerate(path, start=1):
                timestamp, row_id, txn, sender, receiver, amount = edge
                writer.writerow({
                    "Path_ID": path_id,
                    "Hop": hop,
                    "Source_Row_ID": row_id,
                    "Transaction_ID": txn,
                    "Sender_Account": sender,
                    "Receiver_Account": receiver,
                    "Amount": amount,
                    "Timestamp": timestamp
                })

    return output_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("account_id")
    parser.add_argument("--max-hops", type=int, default=4)
    parser.add_argument("--max-outgoing", type=int, default=25)
    parser.add_argument("--max-paths", type=int, default=1000)
    parser.add_argument("--repeat", type=int, default=3)
    args = parser.parse_args()

    if args.max_hops < 1 or args.max_outgoing < 1 or args.max_paths < 1 or args.repeat < 1:
        parser.error("All limits and repeat must be at least 1")

    start = time.perf_counter()
    outgoing = load_outgoing()
    load_time = time.perf_counter() - start

    print(f"Index loaded in {load_time:.3f} seconds")
    print(f"Accounts indexed: {len(outgoing):,}")

    paths = []
    for run in range(1, args.repeat + 1):
        start = time.perf_counter()
        paths = trace_funds(
            args.account_id,
            outgoing,
            args.max_hops,
            args.max_outgoing,
            args.max_paths
        )
        elapsed = time.perf_counter() - start
        print(f"Trace run {run}: {elapsed:.3f} seconds | Paths: {len(paths):,}")

    output_path = save_paths(paths, args.account_id)
    print(f"CSV saved: {output_path}")


if __name__ == "__main__":
    main()
