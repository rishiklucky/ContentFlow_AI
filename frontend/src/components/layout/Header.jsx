import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Plus, LogIn, LogOut, User } from 'lucide-react';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';

export default function Header({ onToggleMobileMenu }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="d-flex align-items-center gap-2 gap-sm-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="d-md-none cf-btn cf-btn-secondary cf-btn-sm p-2 touch-target"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Brand logo & title */}
        <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--cf-ink-primary)',
              color: 'var(--cf-surface-canvas)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--cf-font-mono)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '-0.05em'
            }}
          >
            CF
          </div>
          <div>
            <span className="font-serif fw-bold text-dark d-block lh-1" style={{ fontSize: '1.15rem' }}>
              CONTENTFLOW
            </span>
            <span className="font-mono text-muted d-block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>
              INTELLIGENCE DESK
            </span>
          </div>
        </Link>
      </div>

      {/* Center desktop navigation pill */}
      <div className="d-none d-xl-flex align-items-center gap-3 font-mono" style={{ fontSize: '11px' }}>
        <div className="px-3 py-1 bg-white border hairline-border d-flex align-items-center gap-2">
          <span className="text-muted">MODE:</span>
          <span className="fw-semibold text-dark">SOVEREIGN ATELIER</span>
          <span className="text-muted">/</span>
          <span className="text-muted">SECURITY:</span>
          <span className="fw-semibold text-success">NEON DATABASE CONNECTED</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="d-flex align-items-center gap-2">
        {isAuthenticated ? (
          <>
            <div className="d-none d-md-flex align-items-center gap-1.5 px-2.5 py-1 bg-white border hairline-border font-mono text-xs">
              <User size={13} className="text-muted" />
              <span className="text-dark fw-semibold text-truncate" style={{ maxWidth: '160px' }}>
                {user?.full_name || user?.email}
              </span>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => navigate('/transform/new')}
              className="d-none d-sm-inline-flex"
            >
              NEW DOSSIER
            </Button>

            <Button
              variant="outline"
              size="sm"
              icon={LogOut}
              onClick={handleLogout}
              className="touch-target"
            >
              <span className="d-none d-sm-inline">SIGN OUT</span>
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              icon={LogIn}
              onClick={() => navigate('/login')}
              className="touch-target"
            >
              SIGN IN
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/register')}
              className="d-none d-sm-inline-flex"
            >
              CREATE ACCOUNT
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
