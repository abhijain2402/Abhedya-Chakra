import React, { useEffect, useState } from 'react';
import { fetchDetectionSignals } from '../services/api';
import { Zap, ShieldAlert, Layers, Activity, Users } from 'lucide-react';

export default function DetectionSignalsView() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetectionSignals()
      .then((res) => {
        setSignals(res.signals || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Detection signals error:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">8. Backend Detection Signals Overview</h1>
        <p className="page-description">
          All algorithmic risk detection rules, pattern flags, and heuristic signal outputs active in the backend analysis engine.
        </p>
      </div>

      <div className="grid-cols-2 mb-32">
        {loading ? (
          <div className="card">Loading detection signals...</div>
        ) : (
          signals.map((sig, idx) => (
            <div key={idx} className="card">
              <div className="flex-between mb-20">
                <span className="badge badge-layer-l1">{sig.category}</span>
                <strong style={{ fontSize: '22px', color: '#ffffff' }}>
                  {sig.count?.toLocaleString()} accounts
                </strong>
              </div>

              <h3 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '8px' }}>
                {sig.signal_name}
              </h3>

              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                {sig.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
