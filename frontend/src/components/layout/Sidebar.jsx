import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  FolderKanban,
  History,
  Settings,
  ShieldCheck,
  Cpu,
  Home,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { path: '/', label: 'Overview [Home]', icon: Home, index: '00' },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, index: '01' },
  { path: '/transform/new', label: 'New Transformation', icon: FilePlus, index: '02' },
  { path: '/projects', label: 'Projects Dossier', icon: FolderKanban, index: '03' },
  { path: '/history', label: 'Audit History', icon: History, index: '04' },
  { path: '/settings', label: 'Calibration & Settings', icon: Settings, index: '05' },
];

export default function Sidebar({ onItemClick = null }) {
  const { user } = useAuth();
  return (
    <aside className="app-sidebar">
      {/* Sidebar Header Section Indicator */}
      <div className="p-3 hairline-b d-flex align-items-center justify-content-between font-mono" style={{ fontSize: '10px' }}>
        <span className="text-muted text-uppercase tracking-wider">// WORKSPACE LEDGER</span>
        <span className="badge bg-light text-dark border hairline-border">v1.0</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-grow-1 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onItemClick}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="text-muted font-mono" style={{ fontSize: '10px' }}>
                [{item.index}]
              </span>
              <Icon size={16} strokeWidth={2} />
              <span className="flex-grow-1">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Provenance Box */}
      <div className="m-3 p-2 border hairline-border bg-white font-mono" style={{ fontSize: '10px' }}>
        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="fw-bold text-dark text-uppercase">PROVENANCE FILE</span>
          <span className="stamp-badge">AUTH-01</span>
        </div>
        <div className="text-muted lh-sm" style={{ fontSize: '9px' }}>
          GROUNDING: DETERMINISTIC<br />
          VERIFICATION: STRICT ENFORCEMENT
        </div>
      </div>

      {/* Operator Ledger Footer */}
      <div className="p-3 hairline-t bg-light font-mono" style={{ fontSize: '10px' }}>
        <div className="d-flex align-items-center justify-content-between text-muted mb-1">
          <span>OPERATOR:</span>
          <span className="text-dark fw-bold text-truncate" style={{ maxWidth: '120px' }}>
            {user?.email ? user.email.split('@')[0].toUpperCase() : 'GUEST'}
          </span>
        </div>
        <div className="d-flex align-items-center justify-content-between text-muted">
          <span>DATABASE:</span>
          <span style={{ color: 'var(--cf-accent-green)', fontWeight: 600 }}>NEON ACTIVE</span>
        </div>
      </div>
    </aside>
  );
}
