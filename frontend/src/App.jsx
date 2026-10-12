import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import CustomerPortal from './pages/CustomerPortal';
import AgentDashboard from './pages/AgentDashboard';
import AgentAnalyticsPage from './pages/AgentAnalyticsPage';
import AdminConsolePage from './pages/AdminConsolePage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AuthPage from './pages/AuthPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getAiHealth } from './services/api';
import Icon from './components/Icon';
import './App.css';

const BRAND_NAME = 'SwiftSupport';
const BRAND_TAGLINE = 'Intelligent Support Platform';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function Sidebar() {
  const { user, isCustomer, isAgent, isAdmin, logout } = useAuth();
  const [aiStatus, setAiStatus] = useState({ status: 'checking', active_model: '' });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await getAiHealth();
        setAiStatus(data);
      } catch (err) {
        setAiStatus({ status: 'disconnected', error: err.message });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const roleTheme = {
    admin: { label: 'Administrator', badgeBg: '#f5f3ff', badgeText: '#7c3aed', badgeBorder: '#ddd6fe', avatarBg: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
    agent: { label: 'Support Agent', badgeBg: '#eff6ff', badgeText: '#2563eb', badgeBorder: '#bfdbfe', avatarBg: 'linear-gradient(135deg, #2563eb, #3b82f6)' },
    customer: { label: 'Customer', badgeBg: '#ecfdf5', badgeText: '#059669', badgeBorder: '#a7f3d0', avatarBg: 'linear-gradient(135deg, #059669, #10b981)' },
  };

  const currentTheme = roleTheme[user?.role] || roleTheme.customer;

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            fontWeight: '900',
            boxShadow: '0 6px 14px -3px rgba(79, 70, 229, 0.4)',
            flexShrink: 0,
          }}>
            A
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontWeight: '900',
                fontSize: '16px',
                color: '#0f172a',
                letterSpacing: '-0.4px',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}>
                {BRAND_NAME}
              </span>
              <span style={{
                fontSize: '9px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '12px',
              }}>
                AI
              </span>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              fontWeight: '500',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}>
              {BRAND_TAGLINE}
            </div>
          </div>
        </Link>
      </div>

      {/* Main Sidebar Navigation & Controls */}
      <div className="sidebar-content">
        {/* Navigation Section */}
        <div>
          <div className="sidebar-section-title">Navigation</div>
          <nav className="sidebar-nav">
            {/* Customer Navigation: Submit Ticket and Track Tickets */}
            {isCustomer && (
              <>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name="portal" size={17} />
                  <span>Submit Ticket</span>
                </NavLink>
                <NavLink
                  to="/track"
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name="clock" size={17} />
                  <span>Track Tickets</span>
                </NavLink>
              </>
            )}

            {/* Agent Command Center & Self Analytics: Visible ONLY to support agents */}
            {isAgent && (
              <>
                <NavLink
                  to="/agent"
                  end
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name="dashboard" size={17} />
                  <span>Agent Command Center</span>
                </NavLink>
                <NavLink
                  to="/agent/analytics"
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name="pie-chart" size={17} />
                  <span>View Analytics</span>
                </NavLink>
              </>
            )}

            {/* Admin Console & Analytics: Visible ONLY to admins */}
            {isAdmin && (
              <>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name="admin" size={17} />
                  <span>Admin Console</span>
                </NavLink>
                <NavLink
                  to="/admin/analytics"
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name="metrics" size={17} />
                  <span>Grafana Dashboard</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {/* Admin Observability & Metrics (Visible ONLY to Admin) */}
        {isAdmin && (
          <div>
            <div className="sidebar-section-title">Observability</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <NavLink
                to="/admin/analytics"
                className={({ isActive }) => `sidebar-action-btn ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#ea580c',
                  fontWeight: '700',
                  fontSize: '12px',
                  textDecoration: 'none'
                }}
                title="System Observability & Prometheus Metrics"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="activity" size={15} color="#ea580c" />
                  <span>Live Telemetry</span>
                </div>
                <Icon name="chevron-right" size={12} color="#ea580c" />
              </NavLink>
              <a
                href="http://localhost:8000/metrics"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontWeight: '600',
                  fontSize: '11px',
                  textDecoration: 'none'
                }}
                title="Prometheus Raw Metrics HTTP Stream"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="pulse" size={13} color="#64748b" />
                  <span>Raw /metrics</span>
                </div>
                <Icon name="external" size={11} color="#64748b" />
              </a>
            </div>
          </div>
        )}

        {/* AI Health System Status */}
        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-section-title">System Status</div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '10px',
            backgroundColor: aiStatus.status === 'connected' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${aiStatus.status === 'connected' ? '#bbf7d0' : '#fecaca'}`,
            color: aiStatus.status === 'connected' ? '#15803d' : '#b91c1c',
            fontSize: '12px',
          }}>
            <span
              className="pulse-dot"
              style={{
                backgroundColor: aiStatus.status === 'connected' ? '#22c55e' : '#ef4444',
                flexShrink: 0
              }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: '700', lineHeight: 1.2 }}>
                {aiStatus.status === 'connected' ? 'AI Engine Online' : 'Connecting Engine...'}
              </div>
              <div style={{ fontSize: '10.5px', opacity: 0.85, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {aiStatus.active_model || 'LLM Routing Active'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile Footer */}
      {user && (
        <div className="sidebar-footer">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: currentTheme.avatarBg,
                color: 'white',
                fontSize: '12px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
              }}>
                {getInitials(user.full_name)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#0f172a',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}>
                  {user.full_name}
                </div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: currentTheme.badgeText,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}>
                  {currentTheme.label}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign out of current account"
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <Icon name="logout" size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function ProtectedCustomerRoute({ initialTab = 'submit' }) {
  const { user, isCustomer, isAgent, isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (isAgent) {
    return <Navigate to="/agent" replace />;
  }
  return <CustomerPortal initialTab={initialTab} />;
}

function ProtectedAgentRoute() {
  const { user, isAgent, isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (!isAgent) {
    return <Navigate to="/" replace />;
  }
  return <AgentDashboard />;
}

function ProtectedAgentAnalyticsRoute() {
  const { user, isAgent, isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  if (!isAgent) {
    return <Navigate to="/" replace />;
  }
  return <AgentAnalyticsPage />;
}

function ProtectedAdminRoute() {
  const { user, isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <AdminConsolePage />;
}

function ProtectedAdminAnalyticsRoute() {
  const { user, isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <AdminAnalyticsPage />;
}

function ViewportHeader() {
  const { user } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    if (location.pathname === '/admin/analytics') return 'Grafana Metrics & Analytics Dashboard';
    if (location.pathname === '/admin') return 'Admin Operations Console';
    if (location.pathname === '/agent/analytics') return 'Agent View Analytics';
    if (location.pathname === '/agent') return 'Agent Command Center';
    if (location.pathname === '/track') return 'Track Tickets & Support Replies';
    return 'Submit Support Ticket';
  };

  return (
    <header className="viewport-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
          Workspace
        </span>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
          {getPageTitle()}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          padding: '3px 9px',
          borderRadius: '12px',
          backgroundColor: user?.role === 'admin' ? '#f5f3ff' : user?.role === 'agent' ? '#eff6ff' : '#ecfdf5',
          color: user?.role === 'admin' ? '#7c3aed' : user?.role === 'agent' ? '#2563eb' : '#059669',
          border: `1px solid ${user?.role === 'admin' ? '#ddd6fe' : user?.role === 'agent' ? '#bfdbfe' : '#a7f3d0'}`
        }}>
          Role: {user?.role ? user.role.toUpperCase() : 'GUEST'}
        </span>
      </div>
    </header>
  );
}

// App Content Gated by Authentication with Sidebar Layout
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '600',
        gap: '12px'
      }}>
        <span className="pulse-dot" style={{ backgroundColor: '#38bdf8' }} />
        <span>Loading {BRAND_NAME}...</span>
      </div>
    );
  }

  // If not authenticated, show Sign In / Sign Up full page
  if (!user) {
    return <AuthPage />;
  }

  // After authentication, render sidebar layout
  return (
    <Router>
      <div className="app-layout">
        {/* Modern Sidebar */}
        <Sidebar />

        {/* Viewport Main Container */}
        <div className="main-viewport">
          <ViewportHeader />

          <main className="viewport-body">
            <Routes>
              <Route path="/" element={<ProtectedCustomerRoute initialTab="submit" />} />
              <Route path="/track" element={<ProtectedCustomerRoute initialTab="track" />} />
              <Route path="/agent" element={<ProtectedAgentRoute />} />
              <Route path="/agent/analytics" element={<ProtectedAgentAnalyticsRoute />} />
              <Route path="/admin" element={<ProtectedAdminRoute />} />
              <Route path="/admin/analytics" element={<ProtectedAdminAnalyticsRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
