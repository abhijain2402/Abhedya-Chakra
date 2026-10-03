import React from 'react';
import { InvestigationProvider, useInvestigation } from './context/InvestigationContext';
import Header from './components/Header';
import Navbar from './components/Navbar';

import OverviewView from './views/OverviewView';
import DataAnalysisView from './views/DataAnalysisView';
import AccountInvestigationView from './views/AccountInvestigationView';
import TransactionHistoryView from './views/TransactionHistoryView';
import FundTracingView from './views/FundTracingView';
import NetworkGraphView from './views/NetworkGraphView';
import TimelineView from './views/TimelineView';
import DetectionSignalsView from './views/DetectionSignalsView';
import ReportsExportsView from './views/ReportsExportsView';

import SystemStatusModal from './components/SystemStatusModal';
import NotificationModal from './components/NotificationModal';

import './styles/index.css';

function MainContent() {
  const { activeTab } = useInvestigation();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewView />;
      case 'data_analysis':
        return <DataAnalysisView />;
      case 'investigation':
        return <AccountInvestigationView />;
      case 'history':
        return <TransactionHistoryView />;
      case 'fund_tracing':
        return <FundTracingView />;
      case 'network_graph':
        return <NetworkGraphView />;
      case 'timeline':
        return <TimelineView />;
      case 'detection_signals':
        return <DetectionSignalsView />;
      case 'reports':
        return <ReportsExportsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <main className="main-content">
      {renderActiveView()}
    </main>
  );
}

export default function App() {
  return (
    <InvestigationProvider>
      <div className="app-container">
        <Header />
        <div className="main-wrapper">
          <Navbar />
          <MainContent />
        </div>
        <SystemStatusModal />
        <NotificationModal />
      </div>
    </InvestigationProvider>
  );
}
