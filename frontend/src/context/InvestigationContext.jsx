import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchHealth } from '../services/api';

const InvestigationContext = createContext();

export function InvestigationProvider({ children }) {
  const [selectedAccountId, setSelectedAccountId] = useState('IPOS10017593');
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStatusModalOpen, setSystemStatusModalOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [systemReady, setSystemReady] = useState(true);
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealthData(data);
        setSystemReady(data?.status === 'healthy');
      })
      .catch((err) => {
        console.error('Health check error:', err);
        setSystemReady(false);
      });
  }, []);

  const selectAccount = (accId, targetTab = null) => {
    if (accId) {
      setSelectedAccountId(accId);
      if (targetTab) {
        setActiveTab(targetTab);
      }
    }
  };

  return (
    <InvestigationContext.Provider
      value={{
        selectedAccountId,
        setSelectedAccountId,
        selectAccount,
        activeTab,
        setActiveTab,
        systemStatusModalOpen,
        setSystemStatusModalOpen,
        notificationModalOpen,
        setNotificationModalOpen,
        systemReady,
        healthData
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigation() {
  const context = useContext(InvestigationContext);
  if (!context) {
    throw new Error('useInvestigation must be used within InvestigationProvider');
  }
  return context;
}
