# 🛡️ Abhedya Chakra (अभेद्य चक्र)
### Explainable Mule-Account Risk Analysis & Digital Fund Tracing Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Polars](https://img.shields.io/badge/Data%20Engine-Polars-CD7F32?style=flat)](https://pola.rs/)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Vis.js](https://img.shields.io/badge/Graph-Vis--Network-FF5722?style=flat)](https://visjs.org/)

**Abhedya Chakra** is a high-throughput financial forensic platform engineered to detect mule account networks, analyze money-laundering risk signals, and trace complex transaction trails across large-scale datasets (handling 2,000,000+ transactions in sub-second speeds).

The platform prioritizes **explainable, evidence-based investigation**, providing investigators with visual path isolation, risk breakdowns, and downloadable investigative dossiers.

---

## 🎯 Key Features & Capabilities

### 1. 🔍 Account Risk Fusion Engine
- **Multi-Signal Integration**: Merges fan ratios (fan-in/fan-out), temporal velocity, pass-through speeds, and graph risk scores into a composite percentile rank.
- **Layer Classification**: Categorizes accounts into operational roles:
  - 📥 **L1 Collector** (High incoming fan ratio)
  - 🔄 **L2 Layerer** (Rapid pass-through & intermediate transfer hub)
  - 📤 **L3 Mule Hub / Exfiltration** (High outgoing fan ratio)
- **Review Prioritization**: Instant ranking of high-priority accounts needing regulatory or law enforcement review.

### 2. 🌐 Dynamic Network Topology & Hop Tracing
- **Full Spider-Web Topology**: Interactive visualization of the global transaction graph with dynamic level-of-detail rendering.
- **Hierarchical Hop Tracing**: Traces candidate transaction paths up to 4 hops outward from any selected root account.
- **Path Isolation**: Select and isolate specific transaction chains to inspect exact amounts, timestamps, and hop distances.
- **Connection Chain Explanations**: Click any account node to view a step-by-step breakdown explaining *why* and *how* it connects to the investigated account.

### 3. ⚡ Rapid Pass-Through & Fan Pattern Detection
- **Fan-In / Fan-Out Detection**: Identifies structured structured money pooling (one-to-many & many-to-one).
- **Velocity Analysis**: Flags accounts where funds enter and exit within tight time windows (e.g. < 10 minutes).

### 4. 📄 Investigative Reports & Inter-Bank Alerting
- **Dossier Generation**: Export single-account or multi-hop path reports as styled **PDF documents** or structured **CSV files**.
- **Bank Notification Modal**: Built-in dispatcher to format and transmit official investigation notices to destination banks or regulatory teams.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance asynchronous REST API |
| **Data Engine** | [Polars](https://pola.rs/) + [PyArrow](https://arrow.apache.org/) | Sub-second DataFrame query execution over million-row Parquet datasets |
| **Frontend Framework** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) | Modern, ultra-fast client interface |
| **Graph Visualization** | [Vis-Network](https://visjs.org/) | Canvas & WebGL force-directed and hierarchical graph rendering |
| **Icons & Styling** | [Lucide React](https://lucide.dev/) + Vanilla CSS | Custom high-contrast dark theme UI design system |
| **Reporting** | [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) | Client-side PDF generation & canvas snapshots |

---

## 📁 Project Structure

```text
abhedya-chakra/
├── backend/
│   ├── api/
│   │   └── main.py                # FastAPI REST endpoints & CORS configuration
│   ├── features/                  # Feature engineering & risk aggregation pipelines
│   ├── detection/                 # Fan-in/out and temporal pass-through algorithms
│   └── tracing/                   # Chronological BFS multi-hop fund tracing engine
├── frontend/
│   ├── src/
│   │   ├── components/            # Graphs, Modals, Filters, Metrics & Sidebars
│   │   ├── views/                 # Accounts, Network Topology, Risk Signals views
│   │   ├── context/               # State management (InvestigationContext)
│   │   └── services/api.js        # API integration client
│   ├── index.html
│   └── package.json
├── data/                          # Processed Parquet datasets & transaction logs
├── requirements.txt               # Backend Python dependencies
└── README.md                      # Documentation
```

---

## 🚀 Quick Start Guide

### Data Required

The raw transaction dataset and generated Parquet files are intentionally excluded from Git because they are large, local data artifacts. A clean checkout needs the API datasets described in [`data/README.md`](data/README.md) before the backend can start. The raw CSV alone is not sufficient to rebuild every risk input: some upstream graph and risk-score generation steps are not included in this repository.

### Prerequisites
- **Python**: `3.11` or higher
- **Node.js**: `v20.19.0` or `v22.12.0` or higher (`npm` included)

---

### Step 1: Clone & Setup Backend

1. Navigate to the project root directory:
   ```bash
   cd abhedya-chakra
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```

3. Install required dependencies:
   ```bash
   pip install -r requirements-lock.txt
   ```

4. Start the FastAPI backend server:
   ```bash
   python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8001 --reload
   ```
   > 🌐 **Backend API:** `http://127.0.0.1:8001`<br>
   > 📑 **Interactive API Docs (Swagger):** `http://127.0.0.1:8001/docs`

---

### Step 2: Setup & Run Frontend

1. Open a **new terminal** window and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm ci
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   > 🖥️ **Frontend Application:** `http://localhost:5173`

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | API health check & dataset loading status |
| `GET` | `/overview/stats` | System-wide dataset counters & risk distributions |
| `GET` | `/accounts` | Paginated account list with filtering & risk sorting |
| `GET` | `/accounts/{id}/details` | Comprehensive risk breakdown for a single account |
| `GET` | `/accounts/{id}/trace` | Execute 4-hop chronological fund tracing |
| `GET` | `/network/global-graph` | Fetch global high-hub network topology data |
| `GET` | `/detection/signals` | Fetch fan-in/fan-out & rapid pass-through signal stats |
| `POST` | `/reports/generate` | Generate JSON/CSV investigation summary report |

---

## 📜 License & Disclaimers

This project is built for forensic investigation, academic research, and anti-money laundering (AML) demonstration purposes. Chronological candidate paths and risk percentile scores serve as investigative aids and are not definitive legal proof of illegal activity.