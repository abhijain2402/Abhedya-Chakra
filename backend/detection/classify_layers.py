from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
RAW_DIR = ROOT / "data" / "uploads"
RAW = RAW_DIR / "VoidHacks8_MuleAccount_2M_Transactions.csv"
if not RAW.exists():
    matches = sorted(RAW_DIR.glob("VoidHacks8_MuleAccount_2M_Transactions*.csv"))
    RAW = matches[0] if matches else RAW

GRAPH_FILE = PROCESSED / "account_graph_features.parquet"
RAPID_FILE = PROCESSED / "rapid_pass_through_candidates_v5.parquet"
OUTPUT_FILE = PROCESSED / "account_layer_classification_v1.parquet"
OUTPUT_CSV = PROCESSED / "account_layer_classification_v1.csv"

def main():
    print("[1/4] Loading existing graph features...")
    graph = pd.read_parquet(GRAPH_FILE)

    required = [
        "Account_ID", "Incoming_Count", "Outgoing_Count",
        "Unique_Incoming_Senders", "Unique_Outgoing_Receivers",
        "Collector_Pattern_Flag", "Distributor_Pattern_Flag",
        "Distributor_3_7_Fan_Out_Flag", "Graph_Role_Pattern"
    ]
    missing = [c for c in required if c not in graph.columns]
    if missing:
        raise ValueError(f"Missing graph columns: {missing}")

    graph = graph[required].copy()
    graph["Account_ID"] = graph["Account_ID"].astype(str)

    print("[2/4] Loading rapid pass-through evidence...")
    rapid = pd.read_parquet(RAPID_FILE)
    rapid_accounts = set(rapid.loc[
        rapid["Pass_Through_Flag"].fillna(False), "Account_ID"
    ].astype(str).unique())

    print("[3/4] Scanning raw transactions in chunks for L3 indicators...")
    if not RAW.exists():
        raise FileNotFoundError(f"Raw dataset not found: {RAW}")

    # Only mark signals explicitly supported by the project requirements.
    terminal_counts = {}
    usecols = [
        "Receiver_Account", "Narration", "IP_Address", "Device_Type"
    ]

    for chunk in pd.read_csv(
        RAW, usecols=usecols, chunksize=200_000,
        dtype=str, keep_default_na=False
    ):
        narration = chunk["Narration"].str.lower()
        ip = chunk["IP_Address"].str.strip()
        device = chunk["Device_Type"].str.lower()

        wallet_crypto = narration.str.contains(
            r"wallet|crypto|bitcoin|ethereum|p2p", regex=True, na=False
        )
        foreign_ip_indicator = ip.str.startswith(("185.", "194."))
        headless_device = device.str.contains(
            r"headless", regex=True, na=False
        )

        signal = wallet_crypto | foreign_ip_indicator | headless_device
        flagged = chunk.loc[signal, "Receiver_Account"].astype(str)
        counts = flagged.value_counts()

        for account, count in counts.items():
            terminal_counts[account] = terminal_counts.get(account, 0) + int(count)

    terminal = pd.DataFrame(
        list(terminal_counts.items()),
        columns=["Account_ID", "L3_Signal_Transaction_Count"]
    )
    graph = graph.merge(terminal, on="Account_ID", how="left")
    graph["L3_Signal_Transaction_Count"] = (
        graph["L3_Signal_Transaction_Count"].fillna(0).astype("int64")
    )

    graph["Rapid_Pass_Through_Flag"] = graph["Account_ID"].isin(
        rapid_accounts
    ).astype("int8")

    # Transparent heuristic classification; not a fraud verdict.
    graph["Layer"] = "Unclassified"
    graph["Layer_Evidence"] = "Insufficient configured indicators"

    is_collector = graph["Collector_Pattern_Flag"].fillna(0).astype(bool)
    is_distributor = graph["Distributor_Pattern_Flag"].fillna(0).astype(bool)
    is_rapid = graph["Rapid_Pass_Through_Flag"].eq(1)
    is_terminal = graph["L3_Signal_Transaction_Count"].gt(0)

    graph.loc[is_collector, "Layer"] = "L1_Collector"
    graph.loc[is_collector, "Layer_Evidence"] = "Existing collector graph pattern"

    graph.loc[is_distributor, "Layer"] = "L2_Distributor"
    graph.loc[is_distributor, "Layer_Evidence"] = "Existing distributor graph pattern"

    graph.loc[is_rapid, "Layer"] = "L2_Distributor"
    graph.loc[is_rapid, "Layer_Evidence"] = (
        "Rapid pass-through candidate from V5"
    )

    # Terminal indicators take precedence, but remain heuristic.
    graph.loc[is_terminal, "Layer"] = "L3_Terminal"
    graph.loc[is_terminal, "Layer_Evidence"] = (
        "Receiver transaction has wallet/P2P/crypto narration, "
        "185.x/194.x IP, or headless-device indicator"
    )

    graph["Classification_Note"] = (
        "Rule-based investigation lead; not confirmed fraud or "
        "validated fraud probability."
    )

    graph.to_parquet(OUTPUT_FILE, index=False)
    graph.to_csv(OUTPUT_CSV, index=False)

    print("[4/4] Classification complete.")
    print("Rows:", len(graph))
    print("\nLayer counts:")
    print(graph["Layer"].value_counts(dropna=False).to_string())
    print("\nEvidence counts:")
    print(graph["Layer_Evidence"].value_counts().to_string())
    print("\nSaved:", OUTPUT_FILE)
    print("Saved:", OUTPUT_CSV)

if __name__ == "__main__":
    main()
