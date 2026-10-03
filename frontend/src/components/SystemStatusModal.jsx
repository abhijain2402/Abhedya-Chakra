import React from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { X, Server, Database, Activity, CheckCircle2 } from 'lucide-react';

export default function SystemStatusModal() {
  const { systemStatusModalOpen, setSystemStatusModalOpen, systemReady, healthData } = useInvestigation();

  if (!systemStatusModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setSystemStatusModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex-between mb-20">
          <div className="flex-between gap-12">
            <Server size={22} color="#60a5fa" />
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>System & API Readiness Details</h2>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSystemStatusModalOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <div className="card" style={{ background: '#0b0f19', padding: '14px' }}>
            <span className="stat-label">Backend Status</span>
            <div style={{ fontSize: '15px', color: systemReady ? '#10b981' : '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>
              {systemReady ? '● Ready (FastAPI on http://127.0.0.1:8000)' : '● Offline'}
            </div>
          </div>

          <div className="card" style={{ background: '#0b0f19', padding: '14px' }}>
            <span className="stat-label">API Health</span>
            <div style={{ fontSize: '15px', color: '#ffffff', fontWeight: 'bold', marginTop: '4px' }}>
              Status: {healthData?.status || 'Healthy'}
            </div>
          </div>

          <div className="card" style={{ background: '#0b0f19', padding: '14px' }}>
            <span className="stat-label">Data Status</span>
            <div style={{ fontSize: '14px', color: '#93c5fd', marginTop: '4px' }}>
              VoidHacks8_MuleAccount_2M_Transactions.csv (2,000,000 rows)
            </div>
          </div>

          <div className="card" style={{ background: '#0b0f19', padding: '14px' }}>
            <span className="stat-label">In-Memory Fund Tracing Index Status</span>
            <div style={{ fontSize: '14px', color: '#c4b5fd', marginTop: '4px' }}>
              {healthData?.datasets?.accounts_loaded?.toLocaleString()} accounts indexed in process RAM
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setSystemStatusModalOpen(false)}>
          Close Status Window
        </button>
      </div>
    </div>
  );
}
