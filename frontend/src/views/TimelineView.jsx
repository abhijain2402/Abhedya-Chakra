import React, { useEffect, useState } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { fetchAccountTransactions } from '../services/api';
import { Clock, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';

export default function TimelineView() {
  const { selectedAccountId } = useInvestigation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAccountTransactions(selectedAccountId, { page: 1, limit: 100, direction: 'all' })
      .then((res) => {
        setEvents(res.transactions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Timeline error:', err);
        setLoading(false);
      });
  }, [selectedAccountId]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">7. Chronological Event Timeline</h1>
        <p className="page-description">
          Chronological transaction activity stream for Account ID: <strong style={{ color: '#93c5fd' }}>{selectedAccountId}</strong>
        </p>
      </div>

      <div className="card mb-32">
        {loading ? (
          <div>Loading timeline events...</div>
        ) : events.length === 0 ? (
          <div>No timeline events available for this account.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '24px' }}>
            {/* Timeline Vertical Line */}
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '12px',
                bottom: '12px',
                width: '2px',
                background: 'var(--border-color)'
              }}
            />

            {events.map((ev, idx) => {
              const isIncoming = ev.direction === 'IN';
              return (
                <div key={idx} style={{ position: 'relative', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {/* Event Marker */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-24px',
                      top: '4px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: isIncoming ? '#10b981' : '#ef4444',
                      border: '3px solid var(--bg-card)'
                    }}
                  />

                  <div
                    className="card"
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      background: 'var(--bg-dark)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div className="flex-between mb-20" style={{ marginBottom: '8px' }}>
                      <span className={`badge ${isIncoming ? 'badge-low' : 'badge-high'}`}>
                        {isIncoming ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {isIncoming ? 'Incoming Funds Received' : 'Outgoing Funds Transferred'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ev.timestamp}</span>
                    </div>

                    <div style={{ fontSize: '15px', color: '#ffffff', fontWeight: '600' }}>
                      ₹{ev.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Sender: <strong style={{ color: '#93c5fd' }}>{ev.sender_account}</strong> ➔ Receiver: <strong style={{ color: '#c4b5fd' }}>{ev.receiver_account}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
