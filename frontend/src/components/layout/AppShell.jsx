import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TelemetryRuler from './TelemetryRuler';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import Footer from './Footer';

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-wrapper">
      {/* Top Telemetry Ruler */}
      <TelemetryRuler />

      {/* Main Header */}
      <Header onToggleMobileMenu={() => setMobileMenuOpen(true)} />

      {/* Body Container (Sidebar + Content) */}
      <div className="app-body-container">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Offcanvas Sidebar */}
        <MobileSidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Dynamic Route Content */}
        <main className="app-main-content">
          <Outlet />
        </main>
      </div>

      {/* Status Footer */}
      <Footer />
    </div>
  );
}
