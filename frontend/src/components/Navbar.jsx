import React from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import {
  LayoutDashboard,
  BarChart3,
  UserCheck,
  History,
  GitCommit,
  Network,
  Clock,
  Zap,
  FileSpreadsheet,
  Server
} from 'lucide-react';

export default function Navbar() {
  const { activeTab, setActiveTab, setSystemStatusModalOpen } = useInvestigation();

  const navItems = [
    { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
    { id: 'data_analysis', label: '2. Data Analysis', icon: BarChart3 },
    { id: 'investigation', label: '3. Account Investigation', icon: UserCheck },
    { id: 'history', label: '4. Transaction History', icon: History },
    { id: 'fund_tracing', label: '5. Fund Tracing', icon: GitCommit },
    { id: 'network_graph', label: '6. Network Graph', icon: Network },
    { id: 'timeline', label: '7. Timeline', icon: Clock },
    { id: 'detection_signals', label: '8. Detection Signals', icon: Zap },
    { id: 'reports', label: '9. Reports & Exports', icon: FileSpreadsheet },
    { id: 'system_status', label: '10. System Status', icon: Server }
  ];

  const handleNavClick = (id) => {
    if (id === 'system_status') {
      setSystemStatusModalOpen(true);
    } else {
      setActiveTab(id);
    }
  };

  return (
    <aside className="sidebar-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => handleNavClick(item.id)}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}
