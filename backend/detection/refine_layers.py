import pandas as pd
from pathlib import Path

p = Path("data/processed")
d = pd.read_parquet(p / "account_layer_classification_v1.parquet")

d["Graph_Layer"] = "Unclassified"
d.loc[d["Collector_Pattern_Flag"].eq(1), "Graph_Layer"] = "L1_Collector"
d.loc[d["Distributor_Pattern_Flag"].eq(1), "Graph_Layer"] = "L2_Distributor"

d["L3_Indicator_Flag"] = (
    d["L3_Signal_Transaction_Count"].gt(0).astype("int8")
)

d["Layer"] = d["Graph_Layer"]
d.loc[d["L3_Indicator_Flag"].eq(1), "Layer"] = "L3_Terminal_Candidate"

d["Layer_Evidence"] = "No configured graph pattern"
d.loc[d["Graph_Layer"].eq("L1_Collector"), "Layer_Evidence"] = (
    "Existing collector graph pattern"
)
d.loc[d["Graph_Layer"].eq("L2_Distributor"), "Layer_Evidence"] = (
    "Existing distributor graph pattern"
)
d.loc[d["L3_Indicator_Flag"].eq(1), "Layer_Evidence"] += (
    "; terminal indicator present, requires investigation"
)

d["Classification_Note"] = (
    "Rule-based investigation candidate; not confirmed fraud."
)

out = p / "account_layer_classification_v2.parquet"
csv = p / "account_layer_classification_v2.csv"
d.to_parquet(out, index=False)
d.to_csv(csv, index=False)

print("Layer counts:")
print(d["Layer"].value_counts().to_string())
print("\nGraph role counts:")
print(d["Graph_Layer"].value_counts().to_string())
print("\nL3 candidates by graph role:")
print(d.loc[d["L3_Indicator_Flag"].eq(1), "Graph_Layer"].value_counts().to_string())
print("\nSaved:", out)
print("Saved:", csv)
