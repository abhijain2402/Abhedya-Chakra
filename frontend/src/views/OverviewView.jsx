import React, { useEffect, useState } from 'react';
import { fetchOverviewStats, fetchReviewSuggestions, getExportHighRiskUrl, getExportLowRiskUrl } from '../services/api';
import { useInvestigation } from '../context/InvestigationContext';
import { AlertTriangle, Download, Users, Repeat, Shield, ArrowRight } from 'lucide-react';

export default function OverviewView() {
  const { selectAccount } = useInvestigation();
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchOverviewStats(), fetchReviewSuggestions()])
      .then(([statsData, sugData]) => {
        setStats(statsData);
        setSuggestions(sugData?.suggestions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load overview:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="card">Loading overview statistics...</div>;
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Clean Full-Width Header */}
      <div className="page-header mb-20" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
        <h1 className="page-title" style={{ fontSize: '28px', whiteSpace: 'nowrap' }}>
          1. System Overview & Risk Summary
        </h1>
        <p className="page-description">
          Overall transaction network statistics, account layer classifications, and complete dataset exports.
        </p>
      </div>

      {/* Full Dataset Export Downloads Row */}
      <div className="card mb-32" style={{ border: '1px solid var(--border-color)', padding: '16px 24px' }}>
        <div className="flex-between">
          <span className="stat-label">Full Dataset CSV File Downloads:</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a
              className="btn btn-primary"
              href={getExportHighRiskUrl()}
              download="AbhedyaChakra_Accounts_Requiring_Review_All_Suspicious.csv"
            >
              <Download size={15} />
              <span>Download All Suspicious Accounts ({stats?.accounts_requiring_review?.toLocaleString()})</span>
            </a>

            <a
              className="btn btn-secondary"
              href={getExportLowRiskUrl()}
              download="AbhedyaChakra_Lower_Priority_Accounts_All_Baseline.csv"
            >
              <Download size={15} />
              <span>Download All Non-Suspicious Accounts ({stats?.lower_priority_accounts?.toLocaleString()})</span>
            </a>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid-cols-4 mb-32">
        <div className="card stat-card">
          <div className="stat-label">Total Accounts</div>
          <div className="stat-value">{stats?.total_accounts?.toLocaleString()}</div>
          <div className="stat-subtext">From processed parquet index</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value">2,000,000</div>
          <div className="stat-subtext">VoidHacks8 Mule Dataset</div>
        </div>

        <div className="card stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div className="stat-label" style={{ color: '#fca5a5' }}>Accounts Needing Review</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>
            {stats?.accounts_requiring_review?.toLocaleString()}
          </div>
          <div className="stat-subtext">Final risk percentile ≥ 80.0</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label" style={{ color: '#6ee7b7' }}>Lower Priority Accounts</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            {stats?.lower_priority_accounts?.toLocaleString()}
          </div>
          <div className="stat-subtext">Baseline transaction activity</div>
        </div>
      </div>

      {/* Layer Breakdown Cards */}
      <div className="grid-cols-4 mb-32">
        <div className="card">
          <div className="flex-between mb-20">
            <span className="badge badge-layer-l1">L1 Collector</span>
            <Users size={18} color="#93c5fd" />
          </div>
          <div className="stat-value">{stats?.layer_counts?.L1_Collector?.toLocaleString()}</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Receives money from multiple accounts.
          </p>
        </div>

        <div className="card">
          <div className="flex-between mb-20">
            <span className="badge badge-layer-l2">L2 Distributor</span>
            <Repeat size={18} color="#c4b5fd" />
          </div>
          <div className="stat-value">{stats?.layer_counts?.L2_Distributor?.toLocaleString()}</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Receives money and sends money to multiple accounts.
          </p>
        </div>

        <div className="card">
          <div className="flex-between mb-20">
            <span className="badge badge-layer-l3">L3 Terminal</span>
            <Shield size={18} color="#fbcfe8" />
          </div>
          <div className="stat-value">{stats?.layer_counts?.L3_Terminal?.toLocaleString()}</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Appears near the end of observed transaction paths.
          </p>
        </div>

        <div className="card">
          <div className="flex-between mb-20">
            <span className="badge badge-high">Rapid Pass-Through</span>
            <AlertTriangle size={18} color="#fca5a5" />
          </div>
          <div className="stat-value">{stats?.rapid_pass_through_candidates?.toLocaleString()}</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Transfers 90%+ funds within a 3–15 minute window.
          </p>
        </div>
      </div>

      {/* Five Account Review Suggestions */}
      <div className="card">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
            Accounts to Review (Dynamic Suggestions)
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            3 Higher-priority review candidates and 2 lower-priority comparison accounts based on actual backend risk percentile models.
          </p>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Account ID</th>
                <th>Total Risk %</th>
                <th>Layer</th>
                <th>Top Signals</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((item, idx) => {
                const isHigh = item.review_category.includes('Higher-priority');

                return (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${isHigh ? 'badge-high' : 'badge-low'}`}>
                        {item.review_category}
                      </span>
                    </td>
                    <td>
                      <strong>{item.account_id}</strong>
                    </td>
                    <td>
                      <strong style={{ color: isHigh ? '#ef4444' : '#10b981' }}>
                        {item.total_risk_percentile?.toFixed(1)}%
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block' }}>
                        {item.total_risk_percentile?.toFixed(1)}th percentile
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-layer-${item.layer.toLowerCase().replace('_', '-')}`}>
                        {item.layer}
                      </span>
                    </td>
                    <td>
                      <ul style={{ paddingLeft: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {item.top_signals?.map((sig, i) => (
                          <li key={i}>{sig}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => selectAccount(item.account_id, 'investigation')}
                      >
                        <span>Investigate</span>
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
