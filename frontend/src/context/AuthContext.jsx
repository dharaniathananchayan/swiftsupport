import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getMe } from '../services/api';

const AuthContext = createContext(null);

const DEMO_CREDENTIALS = {
  customer: { email: 'customer@example.com', password: 'customer123', roleName: 'Customer' },
  agent: { email: 'agent@example.com', password: 'agent123', roleName: 'Support Agent' },
  admin: { email: 'admin@example.com', password: 'admin123', roleName: 'Admin' },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cs_auth_token'));
  const [loading, setLoading] = useState(true);

  // Load current user profile if token is in storage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('cs_auth_token');
      if (storedToken) {
        try {
          const profile = await getMe();
          setUser(profile);
          setToken(storedToken);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          localStorage.removeItem('cs_auth_token');
          setToken(null);
          setUser(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    localStorage.setItem('cs_auth_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (userData) => {
    const res = await apiRegister(userData);
    localStorage.setItem('cs_auth_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('cs_auth_token');
    setToken(null);
    setUser(null);
  };

  const switchDemoRole = async (targetRole) => {
    const creds = DEMO_CREDENTIALS[targetRole];
    if (!creds) return;
    try {
      const res = await apiLogin(creds.email, creds.password);
      localStorage.setItem('cs_auth_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    } catch (err) {
      console.error('Failed to switch demo role:', err);
      throw err;
    }
  };

  const isCustomer = user?.role === 'customer';
  const isAgent = user?.role === 'agent';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      switchDemoRole,
      isCustomer,
      isAgent,
      isAdmin,
      DEMO_CREDENTIALS,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
