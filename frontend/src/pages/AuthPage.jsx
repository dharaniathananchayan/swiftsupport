import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

const BRAND_NAME = 'SwiftSupport';
const BRAND_TAGLINE = 'Intelligent Support & Incident Resolution Platform';

const AuthPage = () => {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'customer',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        await register({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      const detail = err.response?.data?.detail || err.message || 'Authentication failed. Please verify credentials.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (email, password) => {
    setFormData(prev => ({
      ...prev,
      email,
      password,
    }));
    setMode('signin');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#090d16',
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.18) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.22) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.12) 0px, transparent 50%)
      `,
      padding: '32px 20px',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative Background Grid */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* Main Container Split: Brand Highlights + Interactive Auth Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '1060px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '40px',
        alignItems: 'center',
      }}>
        {/* Left Side: Brand Value Proposition & Trust Badges */}
        <div style={{ padding: '10px 16px', color: '#ffffff' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '24px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            color: '#93c5fd',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.4px',
            marginBottom: '20px',
            backdropFilter: 'blur(8px)',
          }}>
            <Icon name="shield" size={14} color="#93c5fd" />
            <span>ENTERPRISE SUPPORT PLATFORM</span>
          </div>

          <h1 style={{
            fontSize: '40px',
            fontWeight: '900',
            lineHeight: '1.15',
            letterSpacing: '-1px',
            margin: '0 0 16px 0',
            background: 'linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {BRAND_NAME}
          </h1>

          <p style={{
            fontSize: '16px',
            lineHeight: '1.6',
            color: '#94a3b8',
            margin: '0 0 32px 0',
            maxWidth: '460px',
          }}>
            {BRAND_TAGLINE}. Correlate duplicate outages instantly and streamline support resolution workflows.
          </p>

          {/* Feature Highlights Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
                flexShrink: 0,
              }}>
                <Icon name="layers" size={18} color="#60a5fa" />
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
                  Smart Root-Cause Clustering
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                  Correlates incoming incident reports to prevent agent queue congestion during outages.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
                flexShrink: 0,
              }}>
                <Icon name="reply" size={18} color="#c084fc" />
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
                  Direct Support Resolution
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                  Live customer status progression and transparent technical engineer replies.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                flexShrink: 0,
              }}>
                <Icon name="metrics" size={18} color="#34d399" />
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
                  Zero-Config Observability
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                  Native Prometheus telemetry and real-time Grafana cluster visualization.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Elegant Elevated Glassmorphic Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '36px 32px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15)',
        }}>
          {/* Card Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.35)',
                }}>
                  <Icon name="user" size={18} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.4px' }}>
                    {mode === 'signin' ? 'Sign in to Account' : 'Create New Account'}
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    {mode === 'signin' ? 'Access your dashboard and workspace' : 'Get started with an enterprise role'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Switcher Pills */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '12px',
              padding: '4px',
              marginTop: '20px',
              border: '1px solid #e2e8f0',
            }}>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: mode === 'signin' ? '#ffffff' : 'transparent',
                  color: mode === 'signin' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: mode === 'signin' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Icon name="user" size={14} color={mode === 'signin' ? '#2563eb' : '#64748b'} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: mode === 'signup' ? '#ffffff' : 'transparent',
                  color: mode === 'signup' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: mode === 'signup' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Icon name="plus" size={14} color={mode === 'signup' ? '#2563eb' : '#64748b'} />
                <span>Sign Up</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '10px',
              padding: '11px 14px',
              fontSize: '12.5px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Icon name="alert" size={16} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  <Icon name="user" size={13} color="#64748b" />
                  <span>Full Name</span>
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  name="full_name"
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="auth-input"
                />
              </div>
            )}

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                <Icon name="mail" size={13} color="#64748b" />
                <span>Work Email</span>
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                required
                type="email"
                name="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                className="auth-input"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>
                  <Icon name="lock" size={13} color="#64748b" />
                  <span>Password</span>
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {mode === 'signin' && (
                  <span style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon name="shield" size={11} color="#64748b" />
                    <span>Encrypted JWT</span>
                  </span>
                )}
              </div>
              <input
                required
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="auth-input"
              />
            </div>

            {/* Role Picker for Sign Up */}
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Account Role <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'customer', label: 'Customer', iconName: 'user', desc: 'Submit inquiries' },
                    { id: 'agent', label: 'Agent', iconName: 'dashboard', desc: 'Triage & reply' },
                    { id: 'admin', label: 'Admin', iconName: 'admin', desc: 'Ops & metrics' },
                  ].map((r) => {
                    const isSelected = formData.role === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setFormData(prev => ({ ...prev, role: r.id }))}
                        className={`auth-role-card ${isSelected ? 'selected' : ''}`}
                        style={{ cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                      >
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon name={r.iconName} size={15} color={isSelected ? '#2563eb' : '#64748b'} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? '#1e40af' : '#1e293b' }}>
                          {r.label}
                        </span>
                        <span style={{ fontSize: '10px', color: isSelected ? '#3b82f6' : '#64748b' }}>
                          {r.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                opacity: loading ? 0.8 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? (
                <>
                  <Icon name="refresh" size={16} color="#ffffff" className="spinner" />
                  <span>Authenticating Securely...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Account & Proceed' : 'Sign In to Workspace'}</span>
                  <Icon name="arrow-right" size={16} color="#ffffff" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill for Instant Evaluation */}
          {mode === 'signin' && (
            <div style={{
              marginTop: '22px',
              paddingTop: '18px',
              borderTop: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quick Demo Access
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>1-Click Prefill</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('customer@example.com', 'customer123')}
                  className="auth-demo-btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Icon name="user" size={12} color="#475569" />
                  <span>Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('agent@example.com', 'agent123')}
                  className="auth-demo-btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Icon name="dashboard" size={12} color="#475569" />
                  <span>Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('admin@example.com', 'admin123')}
                  className="auth-demo-btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Icon name="admin" size={12} color="#475569" />
                  <span>Admin</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Switching Prompt */}
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '12.5px',
            color: '#64748b',
          }}>
            {mode === 'signup' ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Need a new account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Create one now
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
