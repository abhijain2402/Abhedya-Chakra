# Data Setup

Project data is distributed separately from the source code because the source transaction file and generated outputs are large. For a fresh checkout, obtain the authorized processed files from the project data owner and preserve these paths:

- `data/processed/integrated_risk_features_v1.parquet`
- `data/processed/account_layer_classification_v1.parquet`
- `data/processed/transaction_edges_with_row_id.parquet`

These three files are required by the API. `data/processed/rapid_pass_through_candidates_v5.parquet` is optional. The raw transaction CSV is needed only for upload or for rebuilding transaction outputs; place it in `data/uploads/`. The processing scripts accept the standard name `VoidHacks8_MuleAccount_2M_Transactions.csv` and downloaded copies with a suffix such as `(1)`. Transfer transaction data only through an authorized private channel; do not commit it to a public repository.

The repository's `data-template.zip` contains this setup guide and empty `raw/`, `uploads/`, and `processed/` directory placeholders only. It does not contain account-level records or the files required to run the API.

## Run the API

The backend requires these files in `data/processed/`:

- `integrated_risk_features_v1.parquet`
- `account_layer_classification_v1.parquet`
- `transaction_edges_with_row_id.parquet`

`rapid_pass_through_candidates_v5.parquet` is optional; without it the API starts without rapid pass-through evidence.

The API cannot start until the required files are supplied. They are not committed because of their size, and a clean checkout cannot recreate all of them from the raw CSV alone. The repository does not include the upstream generators for `account_graph_features.parquet` or the fan, graph, temporal, and final risk score inputs. Obtain those intermediate artifacts from the authorized project data pipeline before generating the layer and integrated-risk files.

## Rebuild Available Transaction Outputs

With the raw CSV in `data/uploads/`, run these commands from the repository root:

```powershell
python tests/rebuild_transaction_edges.py
python tests/add_source_row_id.py
python backend/detection/rapid_pass_through.py
```

The first two commands create `transaction_edges_with_row_id.parquet`, which the API and fund tracing use. The third creates the optional rapid pass-through file. These commands process the full transaction dataset and can require substantial memory and disk space. Other generated files depend on the upstream inputs described above; follow the existing scripts in `backend/detection/` once those inputs are available.