import React, { useEffect, useState } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { fetchAccountDetails, fetchAccounts, generateReport } from '../services/api';
import {
  CheckCircle, FileText, Download, TrendingUp, Shield,
  AlertTriangle, Zap, Users, ChevronDown
} from 'lucide-react';
import PdfReportModal from '../components/PdfReportModal';

export default function AccountInvestigationView() {
  const { selectedAccountId, selectAccount } = useInvestigation();
  const [accountData, setAccountData]   = useState(null);
  const [accountsList, setAccountsList] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showPdf, setShowPdf]           = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAccountDetails(selectedAccountId)
      .then(details => { setAccountData(details); setLoading(false); })
      .catch(err => { console.error('Account detail error:', err); setLoading(false); });
  }, [selectedAccountId]);

  useEffect(() => {
    fetchAccounts({ limit: 10, sortBy: 'priority' }).then(res => {
      setAccountsList(res.accounts || []);
    });
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
          <div style={{ width: 20, height: 20, border: '2px solid rgba(41,121,255,0.3)', borderTopColor: '#2979ff', borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
          Loading account investigation for <strong style={{ color: '#93c5fd' }}>{selectedAccountId}</strong>...
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      </div>
    );
  }

  const p          = accountData?.percentiles || {};
  const isHighPrio = accountData?.anomaly_supported_candidate;
  const passThru   = accountData?.rapid_pass_through || {};

  return (
    <div className="animate-in">

      {/* ── PAGE HEADER ── */}
      <div className="page-header flex-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Account Risk Investigation</h1>
          <p className="page-description">
            Investigating: <span style={{ color: '#93c5fd', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{selectedAccountId}</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* DOWNLOAD PDF REPORT — the main button */}
          <button
            className="btn btn-primary"
            onClick={() => setShowPdf(true)}
            style={{ padding: '9px 18px', fontSize: 13.5, fontWeight: 700, boxShadow: '0 0 20px rgba(41,121,255,0.4)' }}
          >
            <FileText size={16} />
            <span>Download Full PDF Report</span>
          </button>

          {/* Quick account switcher */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={selectedAccountId}
              onChange={e => selectAccount(e.target.value)}
              style={{ paddingRight: 30 }}
            >
              {accountsList.map(acc => (
                <option key={acc.account_id} value={acc.account_id}>
                  {acc.account_id} — {acc.final_risk_percentile?.toFixed(1)}% Risk
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── RISK VERDICT BANNER ── */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: isHighPrio
            ? 'linear-gradient(135deg, rgba(220,38,38,0.14) 0%, rgba(9,18,35,0.96) 100%)'
            : 'linear-gradient(135deg, rgba(100,116,139,0.12) 0%, rgba(9,18,35,0.96) 100%)',
          border: isHighPrio ? '1px solid rgba(220,38,38,0.45)' : '1px solid rgba(148,163,184,0.35)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          {/* Left: score */}
          <div>
            <span
              className={`badge ${isHighPrio ? 'badge-high' : ''}`}
              style={{
                fontSize: 12,
                padding: '5px 14px',
                marginBottom: 14,
                display: 'inline-flex',
                color: isHighPrio ? undefined : '#cbd5e1',
                background: isHighPrio ? undefined : 'rgba(148,163,184,0.12)',
                border: isHighPrio ? undefined : '1px solid rgba(148,163,184,0.3)',
              }}
            >
              {isHighPrio ? <AlertTriangle size={11} style={{ marginRight: 4 }} /> : <Shield size={11} style={{ marginRight: 4 }} />}
              {accountData?.review_priority_label}
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>COMPOSITE RISK RANK</div>
            <div style={{ fontSize: 52, fontWeight: 900, fontFamily: 'var(--font-heading)', color: isHighPrio ? '#f87171' : '#cbd5e1', lineHeight: 1, letterSpacing: '-2px' }}>
              {p.final?.toFixed(1)}<span style={{ fontSize: 24 }}>%</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8, maxWidth: 340 }}>
              Ranks higher than <strong style={{ color: '#f0f6ff' }}>{p.final?.toFixed(1)}%</strong> of all accounts in the analysed dataset.
            </p>
          </div>

          {/* Right: reason box */}
          <div style={{
            background: 'rgba(9,18,35,0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '16px 20px',
            maxWidth: 400, flex: '1 1 320px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isHighPrio ? '#fca5a5' : '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
              Why Review?
            </div>
            <ul style={{ fontSize: 12.5, color: 'var(--text-muted)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.5 }}>
              {accountData?.why_review_reasons?.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* ── 4 RISK DIMENSION TILES ── */}
      <div className="grid-cols-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Fan Risk',           value: p.fan,      sub: 'Incoming/outgoing fan concentration' },
          { label: 'Network Risk',       value: p.graph,    sub: 'Graph topology position' },
          { label: 'Temporal Risk',      value: p.temporal, sub: 'Transaction velocity rank' },
          { label: 'Composite Total',    value: p.final,    sub: 'Integrated multi-signal rank', highlight: true },
        ].map((tile, i) => (
          <div key={i} className="card stat-card" style={tile.highlight ? { border: '1px solid rgba(41,121,255,0.3)', background: 'rgba(41,121,255,0.07)' } : {}}>
            <div className="stat-label">{tile.label}</div>
            <div className="stat-value" style={{ color: tile.highlight ? '#60a5fa' : (tile.value >= 80 ? '#f87171' : '#f0f6ff'), fontSize: 26 }}>
              {tile.value?.toFixed(1)}<span style={{ fontSize: 14, opacity: 0.7 }}>%</span>
            </div>
            {/* Mini progress bar */}
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}>
              <div style={{ width: `${tile.value || 0}%`, height: '100%', borderRadius: 99, background: tile.value >= 80 ? '#ef4444' : tile.value >= 60 ? '#f59e0b' : '#10b981', transition: 'width 1s ease' }} />
            </div>
            <div className="stat-subtext" style={{ marginTop: 4 }}>{tile.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LAYER + PASS-THROUGH ── */}
      <div className="grid-cols-2" style={{ marginBottom: 20 }}>

        {/* Layer Classification */}
        <div className="card">
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, color: '#f0f6ff', fontWeight: 700 }}>Account Layer Classification</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Graph structure and transaction pattern grouping</p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span className={`badge badge-layer-${(accountData?.layer || 'unclassified').toLowerCase().replace(/_/g, '-')}`} style={{ fontSize: 13, padding: '6px 14px' }}>
              {accountData?.layer || 'Unclassified'}
            </span>
          </div>

          <div style={{ background: 'rgba(9,18,35,0.7)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: 12.5, color: '#f0f6ff', display: 'block', marginBottom: 5 }}>Layer Explanation:</strong>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {accountData?.layer === 'L1_Collector'   && '"Receives money from multiple accounts — primary collection node."'}
              {accountData?.layer === 'L2_Distributor' && '"Receives money and sends money to multiple accounts — laundering middle layer."'}
              {accountData?.layer === 'L3_Terminal'    && '"Appears near the end of observed transaction paths — exit/terminal node."'}
              {accountData?.layer === 'Unclassified'   && '"No configured structural pattern was identified; this does not establish legitimate activity."'}
            </p>
            {accountData?.layer_evidence && (
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 7 }}>
                Evidence: {accountData.layer_evidence}
              </div>
            )}
          </div>
        </div>

        {/* Rapid Pass-Through */}
        <div className="card">
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, color: '#f0f6ff', fontWeight: 700 }}>Rapid Pass-Through Detection</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>3–15 minute incoming-to-outgoing fund velocity</p>
          </div>

          {passThru.is_candidate ? (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: 16 }}>
              <span className="badge badge-high" style={{ marginBottom: 12, display: 'inline-flex' }}>
                <Zap size={11} style={{ marginRight: 4 }} /> PASSTHROUGH DETECTED
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'Incoming Amount',      value: `₹${passThru.incoming_amount?.toLocaleString()}`,              color: '#f0f6ff' },
                  { label: 'Dispersal Ratio',       value: `${((passThru.dispersal_ratio || 0) * 100).toFixed(1)}%`,     color: '#f87171' },
                  { label: 'Outgoing Transfers',    value: `${passThru.outgoing_transaction_count || 0} txns`,           color: '#f0f6ff' },
                  { label: 'Downstream Accounts',  value: `${passThru.distinct_downstream_accounts || 0} accounts`,     color: '#fbbf24' },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: 24, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CheckCircle size={36} color="#10b981" />
              <strong style={{ fontSize: 14, color: '#f0f6ff', display: 'block' }}>No Rapid Pass-Through Detected</strong>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.5 }}>
                Funds are not rapidly dispersed within the 3–15 minute screening window.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── PDF REPORT MODAL ── */}
      {showPdf && (
        <PdfReportModal
          accountId={selectedAccountId}
          onClose={() => setShowPdf(false)}
        />
      )}

    </div>
  );
}
