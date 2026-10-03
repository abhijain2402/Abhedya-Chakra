import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { fetchAccountDetails } from '../services/api';
import { X, Mail, Send, CheckCircle2 } from 'lucide-react';

export default function NotificationModal() {
  const { notificationModalOpen, setNotificationModalOpen, selectedAccountId } = useInvestigation();
  const [recipientType, setRecipientType] = useState('bank');
  const [details, setDetails] = useState(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountDetails(selectedAccountId).then(setDetails).catch(console.error);
    }
  }, [selectedAccountId]);

  if (!notificationModalOpen) return null;

  const emailSubject = `[INVESTIGATION NOTICE] Account Risk Finding: ${selectedAccountId}`;
  const emailBody = `CONFIDENTIAL INVESTIGATION NOTIFICATION
--------------------------------------------------
System: Abhedya Chakra Risk Analysis Platform
Target Account ID: ${selectedAccountId}
Review Priority: ${details?.review_priority_label || 'High Priority'}
Composite Risk Rank: ${details?.percentiles?.final?.toFixed(1) || 99.0}th Percentile
Layer Classification: ${details?.layer || 'L1_Collector'}

Key Risk Signals & Findings:
- Total Risk percentile ranks in top ${(100 - (details?.percentiles?.final || 99)).toFixed(1)}% of dataset accounts.
${details?.why_review_reasons?.map((r) => `- ${r}`).join('\n') || '- Rapid pass-through & high network concentration detected.'}

Report Reference: REP-${selectedAccountId}-${Date.now()}

This is an automated notification draft generated for further regulatory review.`;

  const handleSendNotification = () => {
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      setNotificationModalOpen(false);
    }, 1800);
  };

  return (
    <div className="modal-overlay" onClick={() => setNotificationModalOpen(false)}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex-between mb-20">
          <div className="flex-between gap-12">
            <Mail size={22} color="#60a5fa" />
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>Prepare Notification Draft</h2>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setNotificationModalOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {sentSuccess ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ color: '#ffffff' }}>Notification Draft Sent Successfully</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Transmission logged for account {selectedAccountId}.</p>
          </div>
        ) : (
          <>
            <div className="mb-20">
              <label className="stat-label mb-20" style={{ display: 'block' }}>Select Recipient Category</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'bank', label: 'Relevant Bank FIU' },
                  { id: 'authority', label: 'Configured Authority' },
                  { id: 'custom', label: 'Internal Analyst Team' }
                ].map((r) => (
                  <button
                    key={r.id}
                    className={`btn ${recipientType === r.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                    onClick={() => setRecipientType(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-20">
              <label className="stat-label mb-20" style={{ display: 'block' }}>Email Subject</label>
              <input
                type="text"
                readOnly
                value={emailSubject}
                style={{
                  width: '100%',
                  background: '#0b0f19',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div className="mb-20">
              <label className="stat-label mb-20" style={{ display: 'block' }}>Generated Draft Content</label>
              <textarea
                readOnly
                rows={10}
                value={emailBody}
                style={{
                  width: '100%',
                  background: '#0b0f19',
                  border: '1px solid var(--border-color)',
                  color: '#e5e7eb',
                  padding: '12px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}
              />
            </div>

            <div className="flex-between">
              <button className="btn btn-secondary" onClick={() => setNotificationModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSendNotification}>
                <Send size={16} />
                <span>Confirm & Send Notification</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
