import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function MobileSidebar({ isOpen, onClose }) {
  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="mobile-sidebar-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className={`mobile-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="p-3 hairline-b d-flex align-items-center justify-content-between bg-white">
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'var(--cf-ink-primary)',
                color: 'var(--cf-surface-canvas)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--cf-font-mono)',
                fontWeight: 700,
                fontSize: '11px',
              }}
            >
              CF
            </div>
            <span className="font-serif fw-bold text-dark" style={{ fontSize: '1rem' }}>
              CONTENTFLOW
            </span>
          </div>
          <button
            type="button"
            className="cf-btn cf-btn-secondary cf-btn-sm p-1 touch-target"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-grow-1 overflow-auto d-flex flex-column">
          <Sidebar onItemClick={onClose} />
        </div>
      </div>
    </>
  );
}
