import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { traceAccountFunds } from '../services/api';
import { GitCommit, Layers, AlertCircle, Clock, Play } from 'lucide-react';

export default function FundTracingView() {
  const { selectedAccountId, selectAccount } = useInvestigation();
  const [maxHops, setMaxHops] = useState(4);
  const [maxOutgoing, setMaxOutgoing] = useState(25);
  const [maxPaths, setMaxPaths] = useState(100);

  const [traceResult, setTraceResult] = useState(null);
  const [selectedPathId, setSelectedPathId] = useState(1);
  const [tracing, setTracing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleRunTrace = () => {
    setTracing(true);
    setErrorMsg(null);
    traceAccountFunds(selectedAccountId, { maxHops, maxOutgoing, maxPaths })
      .then((data) => {
        setTraceResult(data);
        setSelectedPathId(1);
        setTracing(false);
      })
      .catch((err) => {
        console.error('Trace error:', err);
        setErrorMsg(err.message || 'No candidate paths found');
        setTraceResult(null);
        setTracing(false);
      });
  };

  useEffect(() => {
    handleRunTrace();
  }, [selectedAccountId]);

  const selectedPath = traceResult?.paths?.find((p) => p.path_id === selectedPathId) || traceResult?.paths?.[0];

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">5. Chronological Fund Tracing</h1>
          <p className="page-description">
            Tracing candidate fund-flow paths from Root Account: <strong style={{ color: '#93c5fd' }}>{selectedAccountId}</strong>
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRunTrace}
          disabled={tracing}
        >
          <Play size={16} />
          <span>{tracing ? 'Tracing Paths...' : 'Run Fund Trace'}</span>
        </button>
      </div>

      {/* Tracing Controls Bar */}
      <div className="card mb-32">
        <div className="grid-cols-4">
          <div>
            <label className="stat-label mb-20" style={{ display: 'block' }}>Maximum Hops (1–4)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4].map((h) => (
                <button
                  key={h}
                  className={`btn ${maxHops === h ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px' }}
                  onClick={() => setMaxHops(h)}
                >
                  {h} Hop{h > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="stat-label mb-20" style={{ display: 'block' }}>Max Outgoing Transfers ({maxOutgoing})</label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={maxOutgoing}
              onChange={(e) => setMaxOutgoing(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="stat-label mb-20" style={{ display: 'block' }}>Max Candidate Paths ({maxPaths})</label>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={maxPaths}
              onChange={(e) => setMaxPaths(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'var(--bg-dark)', padding: '10px', borderRadius: '6px', width: '100%' }}>
              In-Memory Cached Index Active (~0.005s per trace)
            </div>
          </div>
        </div>
      </div>

      {/* Limitation Disclaimer Alert */}
      <div
        className="card mb-32"
        style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex',
          gap: '14px',
          alignItems: 'center'
        }}
      >
        <AlertCircle size={22} color="#60a5fa" />
        <span style={{ fontSize: '14px', color: '#dbeafe' }}>
          <strong>Chronological Fund Tracing Limitation:</strong> "These are candidate chronological transaction paths. A chronological path does not by itself prove that the exact same funds moved through every account."
        </span>
      </div>

      {errorMsg && (
        <div className="card mb-32" style={{ border: '1px solid var(--risk-high)', color: '#fca5a5' }}>
          <strong>Trace Warning:</strong> {errorMsg}
        </div>
      )}

      {traceResult && (
        <>
          {/* Trace Summary Metrics */}
          <div className="grid-cols-4 mb-32">
            <div className="card stat-card">
              <div className="stat-label">Paths Found</div>
              <div className="stat-value">{traceResult.paths_found}</div>
              <div className="stat-subtext">Candidate chains</div>
            </div>

            <div className="card stat-card">
              <div className="stat-label">Accounts Involved</div>
              <div className="stat-value">{traceResult.total_accounts_found}</div>
              <div className="stat-subtext">Unique graph nodes</div>
            </div>

            <div className="card stat-card">
              <div className="stat-label">Transactions Included</div>
              <div className="stat-value">{traceResult.total_transactions_found}</div>
              <div className="stat-subtext">Unique edges</div>
            </div>

            <div className="card stat-card">
              <div className="stat-label">Trace Execution Duration</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{traceResult.trace_time_seconds}s</div>
              <div className="stat-subtext">Warm in-memory trace</div>
            </div>
          </div>

          {/* Path Selector Bar */}
          <div className="card mb-20" style={{ padding: '16px' }}>
            <div className="stat-label mb-20">Select Candidate Path:</div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {traceResult.paths?.slice(0, 20).map((path) => (
                <button
                  key={path.path_id}
                  className={`btn ${selectedPathId === path.path_id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => setSelectedPathId(path.path_id)}
                >
                  Path {path.path_id} ({path.hop_count} Hops)
                </button>
              ))}
            </div>
          </div>

          {/* Path Detail Table */}
          {selectedPath && (
            <div className="card mb-32">
              <div className="flex-between mb-20">
                <h3 style={{ fontSize: '18px', color: '#ffffff' }}>
                  Candidate Path #{selectedPath.path_id} Transaction Sequence
                </h3>
                <span className="badge badge-layer-l1">{selectedPath.hop_count} Hops Chain</span>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Hop</th>
                      <th>Sender Account</th>
                      <th>Receiver Account</th>
                      <th>Amount (₹)</th>
                      <th>Timestamp</th>
                      <th>Transaction ID</th>
                      <th>Source Row ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPath.transactions?.map((tx) => (
                      <tr key={tx.hop}>
                        <td><span className="badge badge-low">Hop {tx.hop}</span></td>
                        <td><strong style={{ color: '#93c5fd' }}>{tx.sender_account}</strong></td>
                        <td><strong style={{ color: '#c4b5fd' }}>{tx.receiver_account}</strong></td>
                        <td><strong>₹{tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                        <td>{tx.timestamp}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-dim)' }}>{tx.transaction_id}</td>
                        <td>{tx.source_row_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
