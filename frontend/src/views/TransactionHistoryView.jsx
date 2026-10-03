import React, { useEffect, useState } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { fetchAccountTransactions } from '../services/api';
import { ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, GitCommit } from 'lucide-react';

export default function TransactionHistoryView() {
  const { selectedAccountId } = useInvestigation();
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [direction, setDirection] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAccountTransactions(selectedAccountId, { page, limit: 25, direction })
      .then((res) => {
        setTransactions(res.transactions || []);
        setTotalCount(res.total_transactions || 0);
        setTotalPages(res.total_pages || 1);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load transactions:', err);
        setLoading(false);
      });
  }, [selectedAccountId, page, direction]);

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">4. Transaction History</h1>
          <p className="page-description">
            Showing transactions for Account ID: <strong style={{ color: '#93c5fd' }}>{selectedAccountId}</strong>
          </p>
        </div>

        {/* Direction Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'incoming', 'outgoing'].map((dir) => (
            <button
              key={dir}
              className={`btn ${direction === dir ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '13px', textTransform: 'capitalize' }}
              onClick={() => {
                setDirection(dir);
                setPage(1);
              }}
            >
              {dir === 'incoming' && <ArrowDownLeft size={14} />}
              {dir === 'outgoing' && <ArrowUpRight size={14} />}
              {dir}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-20 flex-between" style={{ padding: '14px 20px' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Showing <strong>{transactions.length}</strong> of <strong>{totalCount.toLocaleString()}</strong> total transactions
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          Page {page} of {totalPages}
        </span>
      </div>

      <div className="table-container mb-20">
        <table>
          <thead>
            <tr>
              <th>Direction</th>
              <th>Hop</th>
              <th>Timestamp</th>
              <th>Sender Account</th>
              <th>Receiver Account</th>
              <th>Amount (₹)</th>
              <th>Transaction ID</th>
              <th>Source Row ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading transactions...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>No transactions found for this filter.</td>
              </tr>
            ) : (
              transactions.map((tx, idx) => {
                const isIncoming = tx.direction === 'IN';
                return (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${isIncoming ? 'badge-low' : 'badge-high'}`}>
                        {isIncoming ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {tx.direction}
                      </span>
                    </td>
                    <td>
                      {tx.hop !== '-' ? (
                        <span className="badge badge-layer-l1" style={{ fontSize: '11px' }}>
                          <GitCommit size={10} />
                          {tx.hop}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td>{tx.timestamp}</td>
                    <td><strong style={{ color: !isIncoming ? '#93c5fd' : '#ffffff' }}>{tx.sender_account}</strong></td>
                    <td><strong style={{ color: isIncoming ? '#93c5fd' : '#ffffff' }}>{tx.receiver_account}</strong></td>
                    <td><strong>₹{tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-dim)' }}>{tx.transaction_id}</td>
                    <td>{tx.source_row_id}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex-between">
        <button
          className="btn btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft size={16} />
          <span>Previous Page</span>
        </button>

        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Page {page} of {totalPages}
        </span>

        <button
          className="btn btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <span>Next Page</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
