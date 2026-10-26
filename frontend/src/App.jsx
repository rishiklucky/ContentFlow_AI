import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import ServerColdStartBoundary from './components/common/ServerColdStartBoundary';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AuthCallbackPage from './pages/auth/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import NewTransformationPage from './pages/NewTransformationPage';
import ProjectsPage from './pages/ProjectsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ServerColdStartBoundary>
          <Routes>
            <Route path="/" element={<AppShell />}>
              {/* Public Routes */}
              <Route index element={<LandingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="auth/callback" element={<AuthCallbackPage />} />

              {/* Protected Workspace Routes */}
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="transform/new"
                element={
                  <ProtectedRoute>
                    <NewTransformationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="transformations/new"
                element={
                  <ProtectedRoute>
                    <NewTransformationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="projects"
                element={
                  <ProtectedRoute>
                    <ProjectsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ServerColdStartBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
