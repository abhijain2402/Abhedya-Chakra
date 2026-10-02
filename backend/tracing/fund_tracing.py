from pathlib import Path
from collections import defaultdict
import argparse
import polars as pl

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed"
INPUT = DATA / "transaction_edges_with_row_id.parquet"

def trace_funds(account_id, max_hops=4, max_outgoing=25, max_paths=1000):
    # Read only the columns needed for tracing.
    df = (
        pl.read_parquet(INPUT)
        .select([
            "Source_Row_ID", "Transaction_ID", "Sender_Account",
            "Receiver_Account", "Amount", "Timestamp"
        ])
        .filter(
            pl.col("Timestamp").is_not_null()
            & pl.col("Sender_Account").is_not_null()
            & pl.col("Receiver_Account").is_not_null()
            & pl.col("Amount").is_not_null()
            & (pl.col("Amount") > 0)
        )
    )

    # Build outgoing transaction index for fast traversal.
    outgoing = defaultdict(list)
    for row in df.iter_rows(named=True):
        sender = row["Sender_Account"]
        receiver = row["Receiver_Account"]
        if sender == receiver:
            continue

        outgoing[sender].append((
            str(row["Timestamp"]),
            int(row["Source_Row_ID"]),
            row["Transaction_ID"],
            sender,
            receiver,
            float(row["Amount"])
        ))

    # Ensure chronological order per sender.
    for sender in outgoing:
        outgoing[sender].sort(key=lambda x: (x[0], x[1]))

    if account_id not in outgoing:
        print(f"No outgoing transactions found for {account_id}")
        return None

    # Each state holds current account, previous time, visited accounts,
    # and the transactions in the candidate chain.
    queue = [(account_id, None, (account_id,), ())]
    cursor = 0
    generated = 0
    results = []

    while cursor < len(queue) and generated < max_paths:
        current, previous_time, visited, path = queue[cursor]
        cursor += 1

        if len(path) >= max_hops:
            continue

        candidates = []
        for edge in outgoing.get(current, []):
            timestamp, row_id, txn_id, sender, receiver, amount = edge

            # Only follow transactions occurring later in time.
            if previous_time is not None and timestamp <= previous_time:
                continue

            # Avoid cycles within the same path.
            if receiver in visited:
                continue

            candidates.append(edge)
            if len(candidates) >= max_outgoing:
                break

        for edge in candidates:
            if generated >= max_paths:
                break

            timestamp, row_id, txn_id, sender, receiver, amount = edge
            new_path = path + (edge,)
            generated += 1
            path_id = generated

            # Store the full chain for this candidate path.
            for hop, event in enumerate(new_path, start=1):
                ts, rid, tid, src, dst, amt = event
                results.append({
                    "Path_ID": path_id,
                    "Hop": hop,
                    "Source_Row_ID": rid,
                    "Transaction_ID": tid,
                    "Sender_Account": src,
                    "Receiver_Account": dst,
                    "Amount": amt,
                    "Timestamp": ts,
                    "Trace_Type": "Chronological candidate path"
                })

            queue.append((
                receiver, timestamp, visited + (receiver,), new_path
            ))

    if not results:
        print(f"No chronological paths found for {account_id}")
        return None

    output = DATA / f"fund_trace_{account_id}.csv"
    pl.DataFrame(results).write_csv(output)

    print("Fund tracing completed.")
    print("Root account:", account_id)
    print("Maximum hops:", max_hops)
    print("Candidate paths generated:", generated)
    print("Saved to:", output)
    return output

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Trace chronological candidate fund-flow paths."
    )
    parser.add_argument("account_id", help="Starting account ID")
    parser.add_argument("--max-hops", type=int, default=4)
    parser.add_argument("--max-outgoing", type=int, default=25)
    parser.add_argument("--max-paths", type=int, default=1000)
    args = parser.parse_args()

    if not 1 <= args.max_hops <= 4:
        parser.error("--max-hops must be between 1 and 4")
    if args.max_outgoing < 1 or args.max_paths < 1:
        parser.error("--max-outgoing and --max-paths must be positive")

    trace_funds(
        args.account_id,
        args.max_hops,
        args.max_outgoing,
        args.max_paths
    )
