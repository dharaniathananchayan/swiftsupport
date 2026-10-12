import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

const AuthModal = ({ isOpen, onClose, initialMode = 'signup' }) => {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'customer'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync mode if changed by parent
  React.useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

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
          role: formData.role
        });
      } else {
        await login(formData.email, formData.password);
      }
      onClose();
    } catch (err) {
      console.error('Authentication error:', err);
      const detail = err.response?.data?.detail || err.message || 'Authentication failed. Please check your credentials.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (email, password) => {
    setFormData(prev => ({
      ...prev,
      email,
      password
    }));
    setMode('signin');
    setError(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '22px 24px 18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
              {mode === 'signup' ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#94a3b8' }}>
              {mode === 'signup'
                ? 'Sign up to submit inquiries or manage support operations'
                : 'Sign in to access your customer dashboard or agent workspace'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon name="close" size={18} color="#94a3b8" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: mode === 'signin' ? '#ffffff' : 'transparent',
              borderBottom: mode === 'signin' ? '2px solid #2563eb' : '2px solid transparent',
              color: mode === 'signin' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
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
              padding: '12px 16px',
              border: 'none',
              background: mode === 'signup' ? '#ffffff' : 'transparent',
              borderBottom: mode === 'signup' ? '2px solid #2563eb' : '2px solid transparent',
              color: mode === 'signup' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
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

        {/* Form Body */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Icon name="alert" size={15} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  <Icon name="user" size={12} color="#64748b" />
                  <span>Full Name</span>
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  name="full_name"
                  placeholder="e.g. Sarah Connor"
                  value={formData.full_name}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                <Icon name="mail" size={12} color="#64748b" />
                <span>Email Address</span>
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                required
                type="email"
                name="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                <Icon name="lock" size={12} color="#64748b" />
                <span>Password</span>
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                required
                type="password"
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Select Account Role <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'customer', label: 'Customer', iconName: 'user', desc: 'Submit inquiries' },
                    { id: 'agent', label: 'Support Agent', iconName: 'dashboard', desc: 'Triage & resolve' },
                    { id: 'admin', label: 'Admin', iconName: 'admin', desc: 'Manage system' }
                  ].map((r) => {
                    const isSelected = formData.role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, role: r.id }))}
                        style={{
                          padding: '10px 6px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                          color: isSelected ? '#1e40af' : '#475569',
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Icon name={r.iconName} size={15} color={isSelected ? '#2563eb' : '#64748b'} />
                        <span style={{ fontSize: '12px', fontWeight: '700' }}>{r.label}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '11px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                opacity: loading ? 0.8 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <Icon name="refresh" size={15} color="#ffffff" className="spinner" />
                  <span>Processing...</span>
                </>
              ) : mode === 'signup' ? (
                <>
                  <span>Create Account & Sign In</span>
                  <Icon name="arrow-right" size={15} color="#ffffff" />
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <Icon name="arrow-right" size={15} color="#ffffff" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill Links for Sign In Mode */}
          {mode === 'signin' && (
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                Quick Demo Accounts (click to pre-fill):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('customer@example.com', 'customer123')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Icon name="user" size={12} color="#475569" />
                  <span>Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('agent@example.com', 'agent123')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Icon name="dashboard" size={12} color="#475569" />
                  <span>Support Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('admin@example.com', 'admin123')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Icon name="admin" size={12} color="#475569" />
                  <span>Admin</span>
                </button>
              </div>
            </div>
          )}

          {/* Toggle mode link */}
          <div style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#64748b'
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
                    padding: 0
                  }}
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Sign Up
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
