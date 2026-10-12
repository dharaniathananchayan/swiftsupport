import axios from 'axios';

const API_URL = 'http://localhost:8000'; // FastAPI backend

const api = axios.create({
  baseURL: API_URL,
});

// Automatically inject JWT token into requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cs_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Auth Endpoints ---
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const getUsers = async () => {
  const response = await api.get('/auth/users');
  return response.data;
};

export const updateUserRole = async (userId, role) => {
  const response = await api.put(`/auth/users/${userId}/role`, { role });
  return response.data;
};

// --- Ticket Endpoints ---
export const getTickets = async () => {
  const response = await api.get('/tickets/');
  return response.data;
};

export const getTicket = async (id) => {
  const response = await api.get(`/tickets/${id}`);
  return response.data;
};

export const createTicket = async (ticketData) => {
  const response = await api.post('/tickets/', ticketData);
  return response.data;
};

export const resolveTicket = async (id) => {
  const response = await api.post(`/tickets/${id}/resolve`);
  return response.data;
};

export const replyTicket = async (id, replyText, resolve = false) => {
  const response = await api.post(`/tickets/${id}/reply`, {
    reply: replyText,
    resolve: resolve,
  });
  return response.data;
};

export const assignTicket = async (id, agentId) => {
  const response = await api.post(`/tickets/${id}/assign`, {
    assigned_agent_id: agentId,
  });
  return response.data;
};

export const autoAssignTicket = async (id) => {
  const response = await api.post(`/tickets/${id}/auto-assign`);
  return response.data;
};

export const updateUserProfile = async (userId, profileData) => {
  const response = await api.put(`/auth/users/${userId}/profile`, profileData);
  return response.data;
};

export const resolveCluster = async (id) => {
  const response = await api.post(`/tickets/${id}/resolve-cluster`);
  return response.data;
};

export const getActiveClusters = async () => {
  const response = await api.get('/tickets/clusters/active');
  return response.data;
};

export const classifyTicket = async (id) => {
  const response = await api.post(`/tickets/${id}/classify`);
  return response.data;
};

// --- Settings & Admin Endpoints ---
export const getSlaPolicies = async () => {
  const response = await api.get('/settings/sla');
  return response.data;
};

export const updateSlaPolicy = async (priority, data) => {
  const response = await api.put(`/settings/sla/${priority}`, data);
  return response.data;
};

export const getAdminAnalytics = async () => {
  const response = await api.get('/settings/analytics');
  return response.data;
};

// --- Health ---
export const getAiHealth = async () => {
  try {
    const response = await api.get('/health/ai');
    return response.data;
  } catch (error) {
    return { status: 'disconnected', error: error.message };
  }
};

export default api;
