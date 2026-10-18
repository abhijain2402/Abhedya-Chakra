import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { generateReport, fetchAccountDetails, fetchOverviewStats, getExportHighRiskUrl, getExportLowRiskUrl } from '../services/api';
import { Download, Mail, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, Shield, TrendingUp } from 'lucide-react';

export default function ReportsExportsView() {
  const { selectedAccountId, setNotificationModalOpen } = useInvestigation();
  const [reportData, setReportData] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [overviewStats, setOverviewStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      generateReport(selectedAccountId),
      fetchAccountDetails(selectedAccountId),
      fetchOverviewStats()
    ]).then(([rep, det, stats]) => {
      setReportData(rep);
      setAccountDetails(det);
      setOverviewStats(stats);
      setLoading(false);
    }).catch((err) => {
      console.error('Report error:', err);
      setLoadError(err.message || 'Could not load report and screening counts.');
      setLoading(false);
    });
  }, [selectedAccountId]);

  const handleDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AbhedyaChakra_Report_${selectedAccountId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const isHighRisk = accountDetails?.anomaly_supported_candidate;

  return (
    <div className="animate-in">
      {loadError && (
        <div className="card" role="alert" style={{ marginBottom: 16, color: '#fca5a5' }}>
          {loadError}
        </div>
      )}
      {/* Page Header */}
      <div className="page-header flex-between" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Reports, Evidence &amp; Data Exports</h1>
          <p className="page-description">
            Generate investigation reports, export structured evidence data, and download complete account files.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDownloadJSON}>
            <Download size={15} />
            <span>Download JSON</span>
          </button>
          <button className="btn btn-primary" onClick={() => setNotificationModalOpen(true)}>
            <Mail size={15} />
            <span>Prepare Notification</span>
          </button>
        </div>
      </div>

      {/* ── EXPORT COMPLETE DATASET SECTION ─────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(9, 18, 35, 0.95) 0%, rgba(15, 31, 56, 0.95) 100%)',
        border: '1px solid rgba(41, 121, 255, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 0 40px rgba(41, 121, 255, 0.06)',
      }}>
        {/* Section header */}
        <div className="flex-between" style={{ marginBottom: '20px', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="badge badge-layer-l1" style={{ marginBottom: '10px', display: 'inline-flex' }}>
              FULL DATASET EXPORTS
            </span>
            <h2 style={{ fontSize: '19px', color: '#ffffff', fontWeight: '700', margin: 0 }}>
              Export Complete Dataset Account Files
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px', maxWidth: '600px' }}>
              Compare rule-based candidates with accounts also identified as behavioral anomalies. Neither result is a confirmed mule/non-mule decision.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {overviewStats?.total_accounts?.toLocaleString()} total accounts
            </span>
          </div>
        </div>

        {/* Two export cards — properly aligned */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
          {/* Anomaly-supported candidates */}
          <div style={{
            background: 'rgba(9, 18, 35, 0.85)',
            border: '1px solid rgba(255, 59, 59, 0.3)',
            borderRadius: '12px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
            transition: 'all 0.25s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,59,59,0.6)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,59,59,0.3)'}
          >
            {/* Card header row */}
            <div className="flex-between" style={{ marginBottom: '14px' }}>
              <span className="badge badge-high" style={{ fontSize: '12px' }}>
                {overviewStats?.anomaly_supported_candidate_count?.toLocaleString()} CANDIDATES
              </span>
              <FileSpreadsheet size={22} color="#fca5a5" />
            </div>

            {/* Card body */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
                Anomaly-Supported Candidates
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55', marginBottom: '0' }}>
                Accounts with Final Risk Percentile ≥ 80 that Isolation Forest also flags as behavioral anomalies.
                These are candidates for validation, not confirmed mules.
              </p>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,59,59,0.2)', margin: '16px 0' }} />

            {/* Download button */}
            <a
              className="btn btn-danger"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
              href={getExportHighRiskUrl()}
              download="AbhedyaChakra_Anomaly_Supported_Candidates.csv"
            >
              <Download size={15} />
              <span>Download Anomaly-Supported Candidates CSV</span>
            </a>
          </div>

          {/* Accounts outside the combined screening result */}
          <div style={{
            background: 'rgba(9, 18, 35, 0.85)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
            transition: 'all 0.25s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.6)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'}
          >
            {/* Card header row */}
            <div className="flex-between" style={{ marginBottom: '14px' }}>
              <span className="badge badge-low" style={{ fontSize: '12px' }}>
                {overviewStats?.outside_candidate_count?.toLocaleString()} ACCOUNTS
              </span>
              <FileSpreadsheet size={22} color="#6ee7b7" />
            </div>

            {/* Card body */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
                Other Screening Results
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55', marginBottom: '0' }}>
                Accounts not selected by both screening stages. Not being selected does not confirm that an account is non-mule.
              </p>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(16,185,129,0.2)', margin: '16px 0' }} />

            {/* Download button */}
            <a
              className="btn btn-success"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
              href={getExportLowRiskUrl()}
              download="AbhedyaChakra_Other_Screening_Results.csv"
            >
              <Download size={15} />
              <span>Download Other Screening Results CSV</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── OFFICIAL INVESTIGATION REPORT CARD ──────────────────────── */}
      {loading ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '14px' }}>Generating investigation report for <strong style={{ color: '#93c5fd' }}>{selectedAccountId}</strong>...</div>
        </div>
      ) : (
        <div className="card" style={{ padding: '24px' }}>
          {/* Report header */}
          <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span className="badge badge-layer-l1" style={{ marginBottom: '8px', display: 'inline-flex' }}>
                Official Investigation Summary
              </span>
              <h2 style={{ fontSize: '20px', color: '#ffffff', fontWeight: '700', margin: 0 }}>
                Report Ref: {reportData?.report_id || `REP-${selectedAccountId}`}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Generated: {reportData?.timestamp}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                className={`badge ${isHighRisk ? 'badge-high' : ''}`}
                style={{
                  fontSize: '13px',
                  padding: '5px 14px',
                  color: isHighRisk ? undefined : '#cbd5e1',
                  background: isHighRisk ? undefined : 'rgba(148,163,184,0.12)',
                  border: isHighRisk ? undefined : '1px solid rgba(148,163,184,0.3)',
                }}
              >
                {reportData?.summary?.review_priority}
              </span>
            </div>
          </div>

          {/* 3 stat tiles */}
          <div className="grid-cols-3" style={{ marginBottom: '20px' }}>
            <div className="card stat-card" style={{ background: 'rgba(9, 18, 35, 0.8)', padding: '16px 18px' }}>
              <div className="stat-label">Target Account</div>
              <strong style={{ fontSize: '16px', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                {selectedAccountId}
              </strong>
            </div>
            <div className="card stat-card" style={{ background: 'rgba(9, 18, 35, 0.8)', padding: '16px 18px' }}>
              <div className="stat-label">Total Risk Rank</div>
              <strong style={{ fontSize: '18px', color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                {reportData?.summary?.total_risk_percentile?.toFixed(1)}th %ile
              </strong>
            </div>
            <div className="card stat-card" style={{ background: 'rgba(9, 18, 35, 0.8)', padding: '16px 18px' }}>
              <div className="stat-label">Layer Classification</div>
              <strong style={{ fontSize: '16px', color: '#c4b5fd' }}>
                {reportData?.summary?.layer}
              </strong>
            </div>
          </div>

          {/* Evidence Findings */}
          <div style={{
            background: 'rgba(9, 18, 35, 0.8)',
            padding: '18px 20px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
          }}>
            <h3 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Key Evidence Findings
            </h3>
            <ul style={{ paddingLeft: '18px', color: 'var(--text-muted)', fontSize: '13.5px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {reportData?.why_detected?.map((ev, i) => (
                <li key={i} style={{ lineHeight: '1.5' }}>{ev}</li>
              ))}
            </ul>
          </div>

          {/* Data Limitations Disclaimer */}
          {reportData?.data_limitations && (
            <div style={{ fontSize: '11.5px', color: 'var(--text-faint)', marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <strong style={{ color: 'var(--text-muted)' }}>Disclaimer:</strong> {reportData.data_limitations}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
