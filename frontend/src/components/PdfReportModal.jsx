import React, { useState, useEffect, useRef } from 'react';
import { fetchAccountDetails, generateReport, fetchAccountTransactions } from '../services/api';
import { X, Printer, Download, Loader } from 'lucide-react';

/**
 * Generates the full HTML string for the PDF report.
 * Pure function — no React state, safe to call inside a useEffect.
 */
function buildReportHtml({ accountId, details, report, transactions, generatedAt }) {
  const p = details?.percentiles || {};
  const isHigh = details?.anomaly_supported_candidate === true;
  const rpt = report?.summary || {};
  const passThrough = details?.rapid_pass_through || {};
  const txRows = (transactions || []).slice(0, 30);

  const riskColor   = isHigh ? '#c0392b' : '#64748b';
  const riskBg      = isHigh ? '#fdecea' : '#f1f5f9';
  const riskLabel   = isHigh ? 'ANOMALY-SUPPORTED REVIEW CANDIDATE' : 'NOT SELECTED BY COMBINED SCREENING';

  const pctBar = (val = 0) => `
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
      <div style="flex:1;height:8px;background:#e0e6ed;border-radius:4px;overflow:hidden;">
        <div style="width:${val}%;height:100%;background:${val >= 80 ? '#c0392b' : val >= 60 ? '#e67e22' : '#27ae60'};border-radius:4px;"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:#1a1a2e;min-width:40px;">${val?.toFixed(1)}%</span>
    </div>`;

  const layerExplain = {
    L1_Collector:   'Receives funds from multiple upstream accounts — primary collection node.',
    L2_Distributor: 'Receives funds and redistributes to multiple downstream accounts.',
    L3_Terminal:    'Appears at the end of observed fund-flow paths — exit node.',
    Unclassified:   'No configured structural pattern was identified; this does not establish that the account is legitimate.',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Abhedya Chakra — Investigation Report — ${accountId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #ffffff;
      padding: 0;
    }

    /* ─── PAGE SETUP ─── */
    @page { size: A4; margin: 18mm 16mm; }
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }

    /* ─── HEADER BANNER ─── */
    .report-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #ffffff;
      padding: 28px 36px 22px;
      border-bottom: 4px solid #2979ff;
    }
    .report-header h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 4px; }
    .report-header .sub { font-size: 11px; color: #93c5fd; letter-spacing: 0.6px; text-transform: uppercase; }
    .header-meta { margin-top: 12px; display: flex; gap: 24px; flex-wrap: wrap; }
    .header-meta span { font-size: 11.5px; color: #cbd5e1; }
    .header-meta strong { color: #ffffff; }

    /* ─── VERDICT BANNER ─── */
    .verdict {
      background: ${riskBg};
      border-left: 5px solid ${riskColor};
      padding: 16px 24px;
      margin: 0;
    }
    .verdict h2 { font-size: 16px; color: ${riskColor}; font-weight: 800; margin-bottom: 6px; }
    .verdict p  { font-size: 12.5px; color: #34495e; line-height: 1.5; }
    .risk-score  { font-size: 42px; font-weight: 900; color: ${riskColor}; line-height: 1; }
    .risk-label  { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: ${riskColor}; margin-top: 2px; }

    /* ─── CONTENT WRAPPER ─── */
    .body-wrap { padding: 24px 36px; }

    /* ─── SECTION ─── */
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #2979ff;
      border-bottom: 1.5px solid #dbeafe;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }

    /* ─── GRID ─── */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }

    /* ─── STAT TILE ─── */
    .tile {
      background: #f8faff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .tile-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: #6b7280; margin-bottom: 4px; }
    .tile-value { font-size: 22px; font-weight: 800; color: #1a1a2e; line-height: 1.1; }
    .tile-sub   { font-size: 10px; color: #9ca3af; margin-top: 2px; }

    /* ─── TABLE ─── */
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th {
      background: #0f172a;
      color: #93c5fd;
      font-weight: 700;
      padding: 8px 10px;
      text-align: left;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f4f8; color: #374151; }
    tr:nth-child(even) td { background: #f8faff; }
    tr:last-child td { border-bottom: none; }

    /* ─── RISK MATRIX ─── */
    .risk-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .risk-row-label { font-size: 12px; font-weight: 600; color: #374151; min-width: 140px; }

    /* ─── EVIDENCE LIST ─── */
    .evidence-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .evidence-list li {
      background: #f0f9ff;
      border-left: 3px solid #0284c7;
      padding: 8px 12px;
      border-radius: 0 6px 6px 0;
      font-size: 12px;
      color: #1e3a5f;
      line-height: 1.45;
    }

    /* ─── PASSTHROUGH BOX ─── */
    .pt-box {
      background: ${passThrough.is_candidate ? '#fef2f2' : '#f0fdf4'};
      border: 1.5px solid ${passThrough.is_candidate ? '#fca5a5' : '#86efac'};
      border-radius: 8px;
      padding: 14px 18px;
    }
    .pt-title { font-size: 13px; font-weight: 800; color: ${passThrough.is_candidate ? '#c0392b' : '#16a085'}; margin-bottom: 8px; }
    .pt-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .pt-item-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .pt-item-val   { font-size: 16px; font-weight: 700; color: #1a1a2e; }

    /* ─── BADGE ─── */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .badge-danger  { background: #fdecea; color: #c0392b; border: 1px solid #fca5a5; }
    .badge-success { background: #eafaf1; color: #16a085; border: 1px solid #86efac; }
    .badge-blue    { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
    .badge-purple  { background: #ede9fe; color: #6d28d9; border: 1px solid #c4b5fd; }

    /* ─── FOOTER ─── */
    .report-footer {
      margin-top: 32px;
      padding: 14px 36px;
      background: #f8faff;
      border-top: 1.5px solid #dbeafe;
      font-size: 10px;
      color: #94a3b8;
    }
    .report-footer strong { color: #64748b; }

    /* ─── WATERMARK ─── */
    .watermark {
      font-size: 10px;
      font-weight: 700;
      color: #dbeafe;
      text-align: center;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 0;
      background: #0f172a;
    }

    /* ─── divider ─── */
    hr { border: none; border-top: 1.5px solid #e2e8f0; margin: 20px 0; }
  </style>
</head>
<body>

<!-- WATERMARK TOP -->
<div class="watermark">ABHEDYA CHAKRA · CONFIDENTIAL INVESTIGATION DOCUMENT · AUTHORISED USE ONLY</div>

<!-- REPORT HEADER -->
<div class="report-header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
    <div>
      <h1>Account Risk Investigation Report</h1>
      <div class="sub">Abhedya Chakra · Digital Fund Tracing &amp; AML Risk Analysis Platform</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#cbd5e1;line-height:1.7;">
      <strong style="color:#ffffff;">Report Ref:</strong> ${report?.report_id || `REP-${accountId}-${Date.now()}`}<br/>
      <strong style="color:#ffffff;">Generated:</strong> ${generatedAt}<br/>
      <strong style="color:#ffffff;">Status:</strong> <span style="color:#4ade80;">ACTIVE INVESTIGATION</span>
    </div>
  </div>
  <div class="header-meta">
    <span><strong>Target Account ID:</strong> ${accountId}</span>
    <span><strong>Layer:</strong> ${details?.layer || 'Unknown'}</span>
    <span><strong>Priority:</strong> ${details?.review_priority_label || 'N/A'}</span>
    <span><strong>Dataset:</strong> 24,873 Accounts · 2M+ Transactions</span>
  </div>
</div>

<!-- VERDICT BANNER -->
<div class="verdict">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
    <div>
      <h2>${riskLabel}</h2>
      <p style="margin-top:6px;max-width:520px;">
        This account ranks higher than approximately <strong>${p.final?.toFixed(1)}%</strong> of all accounts
        in the analysed dataset based on multi-dimensional risk scoring across fan behaviour,
        network topology, and temporal transaction patterns.
      </p>
    </div>
    <div style="text-align:center;">
      <div class="risk-score">${p.final?.toFixed(1)}<span style="font-size:20px;">%</span></div>
      <div class="risk-label">Composite Risk Rank</div>
    </div>
  </div>
</div>

<!-- BODY -->
<div class="body-wrap">

  <!-- SECTION 1: Account Summary -->
  <div class="section">
    <div class="section-title">1. Account Summary</div>
    <div class="grid-2">
      <table>
        <tbody>
          <tr><td><strong>Account ID</strong></td><td style="font-family:monospace;font-size:12px;">${accountId}</td></tr>
          <tr><td><strong>Layer Classification</strong></td><td><span class="badge badge-blue">${details?.layer || 'Unclassified'}</span></td></tr>
          <tr><td><strong>Review Priority</strong></td><td><span class="badge ${isHigh ? 'badge-danger' : 'badge-success'}">${details?.review_priority_label || 'N/A'}</span></td></tr>
          <tr><td><strong>Composite Risk Rank</strong></td><td><strong>${p.final?.toFixed(1)}th Percentile</strong></td></tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr><td><strong>Fan Risk Percentile</strong></td><td>${p.fan?.toFixed(1) || 'N/A'}%</td></tr>
          <tr><td><strong>Network Risk Percentile</strong></td><td>${p.graph?.toFixed(1) || 'N/A'}%</td></tr>
          <tr><td><strong>Temporal Risk Percentile</strong></td><td>${p.temporal?.toFixed(1) || 'N/A'}%</td></tr>
          <tr><td><strong>Report Reference</strong></td><td style="font-family:monospace;font-size:11px;">${report?.report_id || 'N/A'}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- SECTION 2: Risk Score Breakdown -->
  <div class="section">
    <div class="section-title">2. Risk Score Breakdown</div>
    <div class="grid-4">
      <div class="tile">
        <div class="tile-label">Fan Risk</div>
        <div class="tile-value" style="color:${(p.fan||0)>=80?'#c0392b':'#1a1a2e'}">${p.fan?.toFixed(1) || 'N/A'}%</div>
        <div class="tile-sub">Incoming / Outgoing fan concentration</div>
        ${pctBar(p.fan)}
      </div>
      <div class="tile">
        <div class="tile-label">Network Risk</div>
        <div class="tile-value" style="color:${(p.graph||0)>=80?'#c0392b':'#1a1a2e'}">${p.graph?.toFixed(1) || 'N/A'}%</div>
        <div class="tile-sub">Graph topology position rank</div>
        ${pctBar(p.graph)}
      </div>
      <div class="tile">
        <div class="tile-label">Temporal Risk</div>
        <div class="tile-value" style="color:${(p.temporal||0)>=80?'#c0392b':'#1a1a2e'}">${p.temporal?.toFixed(1) || 'N/A'}%</div>
        <div class="tile-sub">Chronological velocity rank</div>
        ${pctBar(p.temporal)}
      </div>
      <div class="tile" style="border-color:${riskColor};background:${riskBg};">
        <div class="tile-label">COMPOSITE TOTAL</div>
        <div class="tile-value" style="color:${riskColor}">${p.final?.toFixed(1) || 'N/A'}%</div>
        <div class="tile-sub">Integrated multi-signal rank</div>
        ${pctBar(p.final)}
      </div>
    </div>
  </div>

  <!-- SECTION 3: Layer Classification -->
  <div class="section">
    <div class="section-title">3. Layer Classification</div>
    <div style="background:#f8faff;border:1.5px solid #dbeafe;border-radius:8px;padding:16px 18px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span class="badge badge-blue" style="font-size:12px;padding:4px 12px;">${details?.layer || 'Unclassified'}</span>
        <strong style="font-size:13px;color:#1a1a2e;">${layerExplain[details?.layer] || 'Classification not available.'}</strong>
      </div>
      ${details?.layer_evidence ? `<p style="font-size:11.5px;color:#64748b;border-top:1px solid #dbeafe;padding-top:8px;margin-top:8px;"><strong>Supporting Evidence:</strong> ${details.layer_evidence}</p>` : ''}
    </div>
  </div>

  <!-- SECTION 4: Key Evidence & Reasons for Review -->
  <div class="section">
    <div class="section-title">4. Key Evidence &amp; Reasons for Review</div>
    <ul class="evidence-list">
      ${(details?.why_review_reasons || report?.why_detected || []).map(r => `<li>● ${r}</li>`).join('')}
      ${(report?.why_detected || []).filter(r => !(details?.why_review_reasons || []).includes(r)).map(r => `<li>● ${r}</li>`).join('')}
    </ul>
  </div>

  <!-- SECTION 5: Rapid Pass-Through Detection -->
  <div class="section">
    <div class="section-title">5. Rapid Pass-Through Detection (3–15 min window)</div>
    <div class="pt-box">
      <div class="pt-title">${passThrough.is_candidate ? '⚡ RAPID PASS-THROUGH DETECTED' : '✓ No Rapid Pass-Through Detected'}</div>
      ${passThrough.is_candidate ? `
      <div class="pt-grid">
        <div>
          <div class="pt-item-label">Incoming Amount</div>
          <div class="pt-item-val">₹${passThrough.incoming_amount?.toLocaleString() || 'N/A'}</div>
        </div>
        <div>
          <div class="pt-item-label">Dispersal Ratio</div>
          <div class="pt-item-val" style="color:#c0392b;">${((passThrough.dispersal_ratio || 0) * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div class="pt-item-label">Outgoing Transfers</div>
          <div class="pt-item-val">${passThrough.outgoing_transaction_count || 0}</div>
        </div>
        <div>
          <div class="pt-item-label">Downstream Accounts</div>
          <div class="pt-item-val">${passThrough.distinct_downstream_accounts || 0}</div>
        </div>
      </div>` : `
      <p style="font-size:12px;color:#374151;">
        Funds are not rapidly dispersed within the 3–15 minute screening window.
        No rapid pass-through laundering pattern observed for this account.
      </p>`}
    </div>
  </div>

  <!-- PAGE BREAK before transactions -->
  <div class="page-break"></div>

  <!-- SECTION 6: Recent Transaction History (up to 30) -->
  <div class="section">
    <div class="section-title">6. Recent Transaction History (Latest ${txRows.length} Transactions)</div>
    ${txRows.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Transaction ID</th>
          <th>Date / Time</th>
          <th>Direction</th>
          <th>Counterparty</th>
          <th style="text-align:right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${txRows.map((tx, i) => {
          const isSender = tx.sender_account === accountId;
          const counterparty = isSender ? tx.receiver_account : tx.sender_account;
          const dir = isSender ? '⟶ OUT' : '⟵ IN';
          const dirColor = isSender ? '#c0392b' : '#16a085';
          return `<tr>
            <td style="color:#94a3b8;">${i + 1}</td>
            <td style="font-family:monospace;font-size:10px;color:#64748b;">${tx.transaction_id || '—'}</td>
            <td style="color:#374151;">${tx.timestamp || '—'}</td>
            <td style="font-weight:700;color:${dirColor};">${dir}</td>
            <td style="font-family:monospace;font-size:11px;">${counterparty || '—'}</td>
            <td style="text-align:right;font-weight:700;color:#1a1a2e;">₹${(tx.amount || 0).toLocaleString()}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p style="font-size:10px;color:#94a3b8;margin-top:8px;">
      * Showing latest ${txRows.length} transactions. Full transaction history available via CSV export.
    </p>` : `<p style="font-size:12px;color:#94a3b8;padding:12px;">No transaction records available for this account.</p>`}
  </div>

  <!-- SECTION 7: Investigation Conclusion -->
  <div class="section">
    <div class="section-title">7. Investigation Conclusion &amp; Recommendation</div>
    <div style="background:${riskBg};border:1.5px solid ${riskColor}50;border-radius:8px;padding:16px 18px;">
      <p style="font-size:13px;font-weight:700;color:${riskColor};margin-bottom:8px;">
        ${isHigh
          ? `RECOMMENDATION: Escalate for regulatory review and potential STR (Suspicious Transaction Report) filing.`
          : `RECOMMENDATION: Flag for routine monitoring. No immediate escalation required.`}
      </p>
      <p style="font-size:12px;color:#374151;line-height:1.6;">
        Based on multi-dimensional risk analysis, account <strong>${accountId}</strong> has been assigned a composite
        risk rank of <strong>${p.final?.toFixed(1)}th percentile</strong> — placing it in the
        ${isHigh ? '<strong>top ' + (100 - p.final).toFixed(1) + '% highest-risk accounts</strong> in the dataset.' : 'lower-risk segment of the dataset.'}
        ${isHigh
          ? ' The account exhibits elevated fan risk, network centrality anomalies, and/or temporal velocity patterns consistent with mule account behaviour.'
          : ' The account does not exhibit primary indicators of mule or layering activity at this threshold.'}
      </p>
    </div>
  </div>

</div><!-- /body-wrap -->

<!-- FOOTER -->
<div class="report-footer">
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
    <div>
      <strong>Abhedya Chakra Risk Analysis Platform</strong> · Digital Fund Tracing &amp; AML Intelligence<br/>
      Report generated: ${generatedAt} · Reference: ${report?.report_id || `REP-${accountId}`}
    </div>
    <div style="text-align:right;">
      <strong>CONFIDENTIAL</strong> — For authorised investigative use only.<br/>
      ${report?.data_limitations || 'Results based on available transaction dataset. Subject to data completeness limitations.'}
    </div>
  </div>
</div>

<!-- WATERMARK BOTTOM -->
<div class="watermark">ABHEDYA CHAKRA · CONFIDENTIAL INVESTIGATION DOCUMENT · AUTHORISED USE ONLY</div>

</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════
   PDF REPORT MODAL
═══════════════════════════════════════════════════════════ */
export default function PdfReportModal({ accountId, onClose }) {
  const iframeRef = useRef(null);

  const [loadingData, setLoadingData] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Fetching account details...');
  const [reportHtml, setReportHtml]   = useState('');
  const [error, setError]             = useState(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    async function loadAll() {
      try {
        setLoadingData(true);

        setLoadingStep('Fetching account details...');
        const details = await fetchAccountDetails(accountId);
        if (cancelled) return;

        setLoadingStep('Generating investigation report...');
        const report  = await generateReport(accountId);
        if (cancelled) return;

        setLoadingStep('Loading transaction history...');
        const txRes   = await fetchAccountTransactions(accountId, { limit: 30, direction: 'all' });
        if (cancelled) return;

        const transactions = txRes?.transactions || [];
        const generatedAt  = new Date().toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });

        const html = buildReportHtml({ accountId, details, report, transactions, generatedAt });
        setReportHtml(html);
        setLoadingData(false);
      } catch (err) {
        console.error('PDF report error:', err);
        setError(err.message || 'Failed to load report data.');
        setLoadingData(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [accountId]);

  // Inject html into iframe once ready
  useEffect(() => {
    if (!iframeRef.current || !reportHtml) return;
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(reportHtml);
    doc.close();
  }, [reportHtml]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = () => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow?.focus();
    iframeRef.current.contentWindow?.print();
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `AbhedyaChakra_Report_${accountId}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>

      {/* ── Top toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(9, 18, 35, 0.98)',
        borderBottom: '1px solid rgba(41,121,255,0.2)',
        flexShrink: 0,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Left: title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #2979ff, #00b4d8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(41,121,255,0.4)',
          }}>
            <Printer size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f0f6ff', fontFamily: 'var(--font-heading)' }}>
              Investigation Report
            </div>
            <div style={{ fontSize: 11.5, color: '#7a9bbf', fontFamily: 'var(--font-mono)' }}>
              {accountId} · Full Account Analysis
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!loadingData && !error && (
            <>
              {/* Download HTML (open in browser → Ctrl+P → Save as PDF) */}
              <button
                onClick={handleDownloadHtml}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(41,121,255,0.12)',
                  border: '1px solid rgba(41,121,255,0.35)',
                  borderRadius: 8, padding: '8px 14px',
                  color: '#93c5fd', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,121,255,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(41,121,255,0.12)'}
                title="Download as HTML file — then open and Ctrl+P to save as PDF"
              >
                <Download size={14} /> Download HTML
              </button>

              {/* Print → Save as PDF */}
              <button
                onClick={handlePrint}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'linear-gradient(135deg, #2979ff, #1565c0)',
                  border: 'none',
                  borderRadius: 8, padding: '8px 18px',
                  color: '#ffffff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  boxShadow: '0 2px 12px rgba(41,121,255,0.4)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(41,121,255,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(41,121,255,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Printer size={14} /> Print / Save as PDF
              </button>
            </>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '8px 14px',
              color: '#94a3b8', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,59,0.15)'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(255,59,59,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          >
            <X size={14} /> Close <span style={{ fontSize: 10, opacity: 0.6 }}>(Esc)</span>
          </button>
        </div>
      </div>

      {/* ── Report area ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#e8edf3' }}>
        {loadingData ? (
          /* Loading state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 16,
          }}>
            <div style={{
              width: 48, height: 48,
              border: '3px solid rgba(41,121,255,0.2)',
              borderTopColor: '#2979ff',
              borderRadius: '50%',
              animation: 'spin 0.85s linear infinite',
            }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f6ff' }}>Building Report...</div>
            <div style={{ fontSize: 12.5, color: '#7a9bbf' }}>{loadingStep}</div>
            <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
          </div>
        ) : error ? (
          /* Error state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fca5a5' }}>Failed to generate report</div>
            <div style={{ fontSize: 12.5, color: '#7a9bbf', maxWidth: 400, textAlign: 'center' }}>{error}</div>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          /* Iframe report preview */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', overflowY: 'auto' }}>
            {/* Info bar */}
            <div style={{
              width: 860, maxWidth: '98%', marginBottom: 12,
              background: 'rgba(9,18,35,0.85)', border: '1px solid rgba(41,121,255,0.2)',
              borderRadius: 8, padding: '8px 16px', fontSize: 11.5, color: '#7a9bbf',
              display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(8px)',
              flexShrink: 0,
            }}>
              <Printer size={12} color="#2979ff" />
              <span>Click <strong style={{ color: '#93c5fd' }}>Print / Save as PDF</strong> above — in the print dialog choose <strong style={{ color: '#93c5fd' }}>"Save as PDF"</strong> as the destination · Enable "Background graphics" for full colour</span>
            </div>

            {/* A4-style iframe */}
            <iframe
              ref={iframeRef}
              title="Investigation Report Preview"
              style={{
                width: 860,
                maxWidth: '98%',
                height: '100%',
                minHeight: 600,
                border: 'none',
                borderRadius: 4,
                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                background: '#ffffff',
                flexShrink: 0,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
