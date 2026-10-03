import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { Shield, Search, Bell, Maximize2, Minimize2 } from 'lucide-react';

export default function Header() {
  const {
    selectedAccountId,
    selectAccount,
    systemReady,
    setSystemStatusModalOpen,
    setNotificationModalOpen
  } = useInvestigation();

  const [searchInput, setSearchInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      selectAccount(searchInput.trim(), 'investigation');
      setSearchInput('');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <header className="header">
      <div className="header-brand">
        <div className="brand-icon">
          <Shield size={18} />
        </div>
        <div>
          <div className="brand-title">Abhedya Chakra</div>
          <div className="brand-subtitle">Risk Analysis &amp; Digital Fund Tracing</div>
        </div>
      </div>

      <form className="header-search" onSubmit={handleSearch}>
        <Search size={15} color="#7a9bbf" />
        <input
          type="text"
          placeholder="Search Account ID (e.g. IPOS10017593)..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="active-account-pill">
          <span style={{ color: '#7a9bbf', fontSize: '11px' }}>ACTIVE:</span>
          <strong>{selectedAccountId}</strong>
        </div>

        <button
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '12px' }}
          onClick={() => setNotificationModalOpen(true)}
          title="Send Notification"
        >
          <Bell size={13} />
          <span>Notify</span>
        </button>

        {/* Fullscreen toggle */}
        <button
          className="fullscreen-toggle-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        <button
          className="status-button"
          onClick={() => setSystemStatusModalOpen(true)}
        >
          <div className={`dot-indicator`} style={{ backgroundColor: systemReady ? '#10b981' : '#ef4444', boxShadow: systemReady ? '0 0 6px #10b981' : '0 0 6px #ef4444' }} />
          <span style={{ fontSize: '11.5px' }}>{systemReady ? 'System Ready' : 'System Offline'}</span>
        </button>
      </div>
    </header>
  );
}
