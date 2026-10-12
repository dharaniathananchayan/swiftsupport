import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTickets, resolveTicket, classifyTicket, getActiveClusters, resolveCluster, replyTicket, assignTicket, getUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

const DEPARTMENT_COLORS = {
  Billing: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Technical: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  Sales: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  Account: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  Shipping: { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
};

const PRIORITY_COLORS = {
  High: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
  Medium: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  Low: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', dot: '#10b981' },
};

const SENTIMENT_ICONS = {
  Positive: { icon: '', label: 'Positive', color: '#059669', bg: '#ecfdf5' },
  Neutral: { icon: '', label: 'Neutral', color: '#4b5563', bg: '#f3f4f6' },
  Negative: { icon: '', label: 'Negative', color: '#dc2626', bg: '#fef2f2' },
};

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatSlaStatus(deadlineString) {
  if (!deadlineString) return null;
  const deadline = new Date(deadlineString);
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    return { label: `SLA Overdue by ${Math.abs(diffHours)}h`, isOverdue: true };
  }
  return { label: `SLA: ${diffHours}h remaining`, isOverdue: false };
}

function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

const AgentDashboard = () => {
  const { user, isCustomer, isAgent, isAdmin } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [activeClusters, setActiveClusters] = useState([]);
  const [expandedClusterIds, setExpandedClusterIds] = useState(new Set());
  const [resolvingClusterId, setResolvingClusterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classifyingIds, setClassifyingIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('tickets'); // 'tickets' | 'clusters'
  const [agentsList, setAgentsList] = useState([]);
  const [assigningTicketId, setAssigningTicketId] = useState(null);
  const [viewingScreenshot, setViewingScreenshot] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const users = await getUsers();
        // Support agents and admins who can be assigned tickets
        const staff = users.filter(u => u.role === 'agent' || u.role === 'admin');
        setAgentsList(staff);
      } catch (err) {
        console.error('Failed to load agents list:', err);
      }
    };
    loadAgents();
  }, []);

  const handleAssignAgent = async (ticketId, agentId) => {
    setAssigningTicketId(ticketId);
    try {
      await assignTicket(ticketId, agentId ? parseInt(agentId, 10) : null);
      await fetchTickets(true);
    } catch (err) {
      console.error('Error assigning agent:', err);
    } finally {
      setAssigningTicketId(null);
    }
  };

  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;

  const fetchTickets = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const [ticketsData, clustersData] = await Promise.all([
        getTickets(),
        getActiveClusters().catch(() => [])
      ]);

      const priorityWeights = { High: 3, Medium: 2, Low: 1 };
      const sorted = [...ticketsData].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Open' ? -1 : 1;
        const weightA = priorityWeights[a.priority] || 0;
        const weightB = priorityWeights[b.priority] || 0;
        return weightB - weightA;
      });

      setTickets(sorted);
      setActiveClusters(clustersData || []);
      setLastSync(new Date());
    } catch (error) {
      console.error('Error fetching tickets or clusters:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Live background polling: checks every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const [replyDrafts, setReplyDrafts] = useState({}); // { [ticketId]: string }
  const [replyingTicketId, setReplyingTicketId] = useState(null);

  const handleReplyChange = (ticketId, text) => {
    setReplyDrafts(prev => ({ ...prev, [ticketId]: text }));
  };

  const handleSendReply = async (ticketId, resolveOnSend = false) => {
    const text = (replyDrafts[ticketId] || '').trim();
    if (!text) return;
    setReplyingTicketId(ticketId);
    try {
      await replyTicket(ticketId, text, resolveOnSend);
      setReplyDrafts(prev => ({ ...prev, [ticketId]: '' }));
      await fetchTickets(true);
    } catch (error) {
      console.error('Error submitting technical support reply:', error);
    } finally {
      setReplyingTicketId(null);
    }
  };

  const handleResolve = async (id) => {
    try {
      await resolveTicket(id);
      fetchTickets(true);
    } catch (error) {
      console.error('Error resolving ticket:', error);
    }
  };

  const handleResolveCluster = async (parentId) => {
    setResolvingClusterId(parentId);
    try {
      await resolveCluster(parentId);
      await fetchTickets(true);
    } catch (error) {
      console.error('Error resolving incident cluster:', error);
    } finally {
      setResolvingClusterId(null);
    }
  };

  const toggleClusterExpand = (clusterId) => {
    setExpandedClusterIds(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

  const handleClassify = async (id) => {
    setClassifyingIds(prev => new Set(prev).add(id));
    try {
      await classifyTicket(id);
      await fetchTickets(true);
    } catch (error) {
      console.error('Error triggering classification:', error);
    } finally {
      setClassifyingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'Open').length;
    const resolved = tickets.filter(t => t.status === 'Resolved').length;
    const high = tickets.filter(t => t.priority === 'High' && t.status === 'Open').length;
    const classified = tickets.filter(t => t.department && t.priority).length;
    return { total, open, resolved, high, classified };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) return false;
      if (deptFilter !== 'ALL' && ticket.department !== deptFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchSubject = ticket.subject?.toLowerCase().includes(query);
        const matchCustomer = ticket.customer_name?.toLowerCase().includes(query);
        const matchEmail = ticket.customer_email?.toLowerCase().includes(query);
        const matchSummary = ticket.summary?.toLowerCase().includes(query);
        const matchId = ticket.id?.toString().includes(query);
        return matchSubject || matchCustomer || matchEmail || matchSummary || matchId;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, deptFilter, searchQuery]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Support Operations Hub
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '20px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
            }}>
              Live Synced
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            AI-assisted ticket intelligence, SLA prioritization, and department routing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Updated {formatRelativeTime(lastSync)}
          </span>
          <Link
            to="/agent/analytics"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #c7d2fe',
              backgroundColor: '#eef2ff',
              color: '#4338ca',
              fontWeight: '700',
              fontSize: '13px',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon name="pie-chart" size={14} color="#4338ca" />
            <span>View Analytics</span>
          </Link>
          <button
            onClick={() => fetchTickets(false)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: '600',
              fontSize: '13px',
              boxShadow: 'var(--shadow-xs)',
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <Icon name="refresh" size={14} color="#334155" className={refreshing ? 'spinner' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          {isAdmin && (
            <Link
              to="/admin/analytics"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
                textDecoration: 'none',
              }}
            >
              <Icon name="metrics" size={15} color="#ffffff" />
              <span>System Analytics</span>
            </Link>
          )}
        </div>
      </div>

      {/* Role Notice Banner */}
      {isCustomer && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          color: '#1e40af'
        }}>
          <Icon name="alert" size={16} color="#1e40af" />
          <span>
            You are signed in as <strong>{user?.full_name}</strong> (Customer). You are viewing your personal submitted tickets. To triage the global queue or resolve outage clusters, sign in as a Support Agent or Admin.
          </span>
        </div>
      )}

      {/* Observability Banner (Visible only to Admin) */}
      {isAdmin && (
        <div style={{
          backgroundColor: '#fff7ed',
          borderRadius: '12px',
          border: '1px solid #fed7aa',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="activity" size={18} color="#ea580c" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#9a3412' }}>
                Prometheus & System Observability Live
              </div>
              <div style={{ fontSize: '12px', color: '#c2410c' }}>
                Real-time telemetry tracking SLA compliance, department load distribution, and AI processing latency.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href="http://localhost:8000/metrics"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid #fed7aa',
                color: '#c2410c',
                textDecoration: 'none'
              }}
            >
              Raw /metrics Stream ↗
            </a>
            <Link
              to="/admin/analytics"
              style={{
                fontSize: '12px',
                fontWeight: '700',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icon name="metrics" size={13} color="#ffffff" />
              <span>Launch Analytics Dashboard</span>
            </Link>
          </div>
        </div>
      )}

      {/* Metric Cards KPI row (Visible only to Admin) */}
      {isAdmin && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Tickets
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {metrics.total}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Across all queues
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '18px 20px',
            border: '1px solid #fed7aa',
            boxShadow: 'var(--shadow-xs)',
            background: 'linear-gradient(to bottom right, #fff, #fffbeb)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Open Tickets
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
              {metrics.open}
            </div>
            <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
              Awaiting agent resolution
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '18px 20px',
            border: '1px solid #fecaca',
            boxShadow: 'var(--shadow-xs)',
            background: 'linear-gradient(to bottom right, #fff, #fef2f2)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              High Priority Active
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>
              {metrics.high}
            </div>
            <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
              Require urgent attention
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '18px 20px',
            border: '1px solid #a7f3d0',
            boxShadow: 'var(--shadow-xs)',
            background: 'linear-gradient(to bottom right, #fff, #ecfdf5)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resolved
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
              {metrics.resolved}
            </div>
            <div style={{ fontSize: '12px', color: '#065f46', marginTop: '2px' }}>
              Successfully closed
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '18px 20px',
            border: '1px solid #ddd6fe',
            boxShadow: 'var(--shadow-xs)',
            background: 'linear-gradient(to bottom right, #fff, #f5f3ff)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              AI Enriched
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#8b5cf6', marginTop: '4px' }}>
              {metrics.classified}/{metrics.total}
            </div>
            <div style={{ fontSize: '12px', color: '#6d28d9', marginTop: '2px' }}>
              Classified by AI Engine
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        boxShadow: 'var(--shadow-xs)',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search tickets by ID, subject, customer, or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              outline: 'none',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <Icon name="search" size={15} color="#94a3b8" />
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Icon name="close" size={13} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Status: All</option>
            <option value="Open">Status: Open</option>
            <option value="Resolved">Status: Resolved</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Priority: All</option>
            <option value="High">Priority: High</option>
            <option value="Medium">Priority: Medium</option>
            <option value="Low">Priority: Low</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Department: All</option>
            <option value="Technical">Technical</option>
            <option value="Billing">Billing</option>
            <option value="Account">Account</option>
            <option value="Sales">Sales</option>
            <option value="Shipping">Shipping</option>
          </select>

          {/* View Mode Toggle: All Tickets vs. View Incident Clusters */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('tickets')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'tickets' ? '#ffffff' : 'transparent',
                color: viewMode === 'tickets' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'tickets' ? '700' : '600',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: viewMode === 'tickets' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Icon name="ticket" size={14} color={viewMode === 'tickets' ? '#0f172a' : '#64748b'} />
              <span>All Tickets</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('clusters')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'clusters' ? '#ffffff' : 'transparent',
                color: viewMode === 'clusters' ? '#92400e' : '#64748b',
                fontWeight: viewMode === 'clusters' ? '700' : '600',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: viewMode === 'clusters' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Icon name="layers" size={14} color={viewMode === 'clusters' ? '#92400e' : '#64748b'} />
              <span>View Clusters</span>
              <span style={{
                backgroundColor: '#fef3c7',
                color: '#b45309',
                padding: '1px 5px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '800'
              }}>
                {activeClusters.length}
              </span>
            </button>
          </div>

          {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || deptFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setDeptFilter('ALL');
                setSearchQuery('');
              }}
              style={{
                fontSize: '12px',
                color: '#64748b',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f1f5f9'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Active Incident Outage & Duplicate Clusters Banner */}
      {activeClusters.length > 0 && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="layers" size={18} color="#b45309" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#92400e' }}>
                  AI-Detected Incident Clusters & Outages ({activeClusters.length})
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#b45309' }}>
                  The AI Copilot has correlated multiple incoming tickets describing identical root issues.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeClusters.map((cluster) => {
              const isExpanded = expandedClusterIds.has(cluster.parent_ticket.id);
              const isResolving = resolvingClusterId === cluster.parent_ticket.id;

              return (
                <div
                  key={cluster.parent_ticket.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #fcd34d',
                    padding: '14px 18px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a'
                      }}>
                         {cluster.cluster_tag}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                        #{cluster.parent_ticket.id} - {cluster.parent_ticket.subject}
                      </strong>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid #bfdbfe'
                      }}>
                        {cluster.total_affected} tickets affected
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {cluster.child_tickets.length > 0 && (
                        <button
                          onClick={() => toggleClusterExpand(cluster.parent_ticket.id)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {isExpanded ? 'Hide Duplicates ▲' : `View Clustered (${cluster.child_tickets.length}) ▼`}
                        </button>
                      )}

                      <button
                        onClick={() => handleResolveCluster(cluster.parent_ticket.id)}
                        disabled={isResolving}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          backgroundColor: '#d97706',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: isResolving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(217, 119, 6, 0.3)'
                        }}
                      >
                        <span></span>
                        <span>{isResolving ? 'Resolving...' : `Bulk Resolve Incident (${cluster.total_affected})`}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable child tickets list */}
                  {isExpanded && cluster.child_tickets.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #fef3c7',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase' }}>
                        Clustered Duplicate Inquiries:
                      </div>
                      {cluster.child_tickets.map((child) => (
                        <div
                          key={child.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#fffbeb',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid #fef3c7'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: '700', color: '#92400e', marginRight: '6px' }}>
                              #{child.id}
                            </span>
                            <span style={{ color: '#1e293b', fontWeight: '600' }}>
                              {child.subject}
                            </span>
                            <span style={{ color: '#64748b', marginLeft: '8px' }}>
                              by {child.customer_name} ({child.customer_email})
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatRelativeTime(child.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticket List OR Clustered View */}
      {viewMode === 'clusters' ? (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                AI Incident Clusters & Duplicate Groups ({activeClusters.length})
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Incoming inquiries that share identical root issues clustered together under single parent tickets.
              </p>
            </div>
            <button
              onClick={() => setViewMode('tickets')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ← Back to All Tickets
            </button>
          </div>

          {activeClusters.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '60px 20px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}></div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>No Outage Clusters Detected</h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
                All incoming tickets currently appear to be independent inquiries.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {activeClusters.map(cluster => {
                const isResolving = resolvingClusterId === cluster.parent_ticket.id;
                return (
                  <div
                    key={cluster.parent_ticket.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '2px solid #fcd34d',
                      boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)',
                      padding: '24px',
                    }}
                  >
                    {/* Cluster Parent Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '800',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a'
                          }}>
                             CLUSTER: {cluster.cluster_tag}
                          </span>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid #bfdbfe'
                          }}>
                            {cluster.total_affected} Total Customers Impacted
                          </span>
                        </div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                          #{cluster.parent_ticket.id} - {cluster.parent_ticket.subject}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                          Reported by <strong>{cluster.parent_ticket.customer_name}</strong> ({cluster.parent_ticket.customer_email})
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleResolveCluster(cluster.parent_ticket.id)}
                          disabled={isResolving}
                          style={{
                            padding: '8px 18px',
                            borderRadius: '8px',
                            backgroundColor: '#d97706',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: isResolving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(217, 119, 6, 0.3)'
                          }}
                        >
                          <span></span>
                          <span>{isResolving ? 'Resolving Cluster...' : `Bulk Resolve All (${cluster.total_affected})`}</span>
                        </button>
                      </div>
                    </div>

                    {/* Root Cause Description */}
                    <div style={{
                      backgroundColor: '#f8fafc',
                      borderLeft: '4px solid #f59e0b',
                      padding: '12px 16px',
                      borderRadius: '0 8px 8px 0',
                      fontSize: '13px',
                      color: '#334155',
                      marginBottom: '18px',
                      lineHeight: '1.5'
                    }}>
                      <strong>Root Ticket Description:</strong> {cluster.parent_ticket.description}
                    </div>

                    {/* Duplicate Child Tickets Under this Parent */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '10px' }}>
                        Grouped Inquiries Under This Cluster ({cluster.child_tickets.length}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {cluster.child_tickets.map(child => (
                          <div
                            key={child.id}
                            style={{
                              backgroundColor: '#fffbeb',
                              border: '1px solid #fef3c7',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '13px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: '800', color: '#92400e' }}>#{child.id}</span>
                              <span style={{ fontWeight: '600', color: '#0f172a' }}>{child.subject}</span>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>({child.customer_name})</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {formatRelativeTime(child.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <div className="spinner" style={{ fontSize: '24px', marginBottom: '12px' }}></div>
          <div>Loading ticket workspace...</div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px dashed #cbd5e1',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}></div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>No tickets match your filters</h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
            Try clearing filters or search parameters to view all active customer inquiries.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTickets.map(ticket => {
            const isPending = !ticket.department || !ticket.priority;
            const isClassifying = classifyingIds.has(ticket.id);
            const deptStyle = DEPARTMENT_COLORS[ticket.department] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
            const priorityStyle = PRIORITY_COLORS[ticket.priority] || { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', dot: '#94a3b8' };
            const sentimentInfo = SENTIMENT_ICONS[ticket.sentiment] || { icon: '', label: ticket.sentiment || 'Analyzing', color: '#64748b', bg: '#f1f5f9' };
            const slaStatus = formatSlaStatus(ticket.sla_deadline);

            return (
              <div
                key={ticket.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: ticket.is_cluster_parent ? '2px solid #fcd34d' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  padding: '22px 24px',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                }}
              >
                {/* Ticket Top Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      fontWeight: '700',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #bfdbfe'
                    }}>
                      {getInitials(ticket.customer_name)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
                          {ticket.customer_name}
                        </span>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>•</span>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {ticket.customer_email}
                        </span>

                        {/* Cluster Identifiers */}
                        {ticket.is_cluster_parent && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '800',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a'
                          }}>
                             Outage Root ({ticket.clustered_tickets_count || 1} duplicates)
                          </span>
                        )}

                        {ticket.parent_ticket_id && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '700',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe'
                          }}>
                             Duplicate of #{ticket.parent_ticket_id}
                          </span>
                        )}

                        {ticket.cluster_tag && !ticket.is_cluster_parent && !ticket.parent_ticket_id && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '700',
                            backgroundColor: '#faf5ff',
                            color: '#7e22ce',
                            border: '1px solid #e9d5ff'
                          }}>
                             {ticket.cluster_tag}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Submitted {formatRelativeTime(ticket.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Status, SLA Badges, and Assigned Agent */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Auto-Assigned Agent Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {ticket.assigned_agent ? (
                        <span style={{
                          padding: '4px 9px',
                          borderRadius: '8px',
                          border: '1px solid #bbf7d0',
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span></span>
                          <span>Assigned: {ticket.assigned_agent.full_name}</span>
                        </span>
                      ) : (
                        <span style={{
                          padding: '4px 9px',
                          borderRadius: '8px',
                          border: '1px solid #fed7aa',
                          backgroundColor: '#fff7ed',
                          color: '#c2410c',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                           Auto-Routing...
                        </span>
                      )}
                    </div>

                    {slaStatus && ticket.status === 'Open' && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '4px 9px',
                        borderRadius: '6px',
                        backgroundColor: slaStatus.isOverdue ? '#fef2f2' : '#f8fafc',
                        color: slaStatus.isOverdue ? '#dc2626' : '#64748b',
                        border: `1px solid ${slaStatus.isOverdue ? '#fecaca' : '#e2e8f0'}`,
                      }}>
                         {slaStatus.label}
                      </span>
                    )}

                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: ticket.status === 'Resolved' ? '#ecfdf5' : '#fffbeb',
                      color: ticket.status === 'Resolved' ? '#065f46' : '#b45309',
                      border: `1px solid ${ticket.status === 'Resolved' ? '#a7f3d0' : '#fde68a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span>{ticket.status === 'Resolved' ? 'Yes' : ''}</span>
                      <span>{ticket.status}</span>
                    </span>
                  </div>
                </div>

                {/* Ticket Subject & Description */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                      #{ticket.id}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                      {ticket.subject}
                    </h3>
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: '#334155',
                    marginTop: '8px',
                    lineHeight: '1.6',
                    backgroundColor: '#f8fafc',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #f1f5f9'
                  }}>
                    {ticket.description}
                  </p>

                  {/* Customer Attached Screenshot */}
                  {ticket.screenshot_url && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={ticket.screenshot_url}
                          alt={`Screenshot for ticket #${ticket.id}`}
                          onClick={() => setViewingScreenshot(ticket.screenshot_url)}
                          style={{
                            width: '68px',
                            height: '46px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name="image" size={13} color="#2563eb" />
                            <span>Customer Attached Screenshot</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Click image thumbnail to expand in high resolution
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingScreenshot(ticket.screenshot_url)}
                        style={{
                          padding: '6px 13px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#2563eb',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Icon name="search" size={12} color="#2563eb" />
                        <span>View Screenshot</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Copilot Classification Panel */}
                <div style={{
                  marginTop: '16px',
                  borderRadius: '10px',
                  border: isPending ? '1px dashed #cbd5e1' : '1px solid #e9d5ff',
                  background: isPending ? '#f8fafc' : 'linear-gradient(to right, #faf5ff 0%, #fdf4ff 100%)',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
                        color: 'white',
                        padding: '2px 7px',
                        borderRadius: '6px'
                      }}>
                        AI Intelligence
                      </span>
                      <span style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '600' }}>
                        Automated Ticket Classification
                      </span>
                    </div>

                    <button
                      onClick={() => handleClassify(ticket.id)}
                      disabled={isClassifying}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #d8b4fe',
                        color: '#7c3aed',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        cursor: isClassifying ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span className={isClassifying ? 'spinner' : ''}></span>
                      <span>{isClassifying ? 'Classifying...' : isPending ? 'Classify Ticket' : 'Re-analyze'}</span>
                    </button>
                  </div>

                  {isPending ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', padding: '6px 0' }}>
                      <span className="pulse-dot" style={{ backgroundColor: '#a855f7' }}></span>
                      <span>AI Engine is currently evaluating this ticket in the background...</span>
                    </div>
                  ) : (
                    <>
                      {/* Classification Tags Grid */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        {/* Department Tag */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: deptStyle.bg,
                          color: deptStyle.text,
                          border: `1px solid ${deptStyle.border}`
                        }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Dept:</span>
                          <span>{ticket.department}</span>
                        </div>

                        {/* Priority Tag */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: priorityStyle.bg,
                          color: priorityStyle.text,
                          border: `1px solid ${priorityStyle.border}`
                        }}>
                          <span style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: priorityStyle.dot
                          }} />
                          <span style={{ fontSize: '11px', opacity: 0.8 }}>Priority:</span>
                          <span>{ticket.priority}</span>
                        </div>

                        {/* Sentiment Tag */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: sentimentInfo.bg,
                          color: sentimentInfo.color,
                          border: '1px solid #e2e8f0'
                        }}>
                          <span>{sentimentInfo.icon}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Sentiment:</span>
                          <span>{sentimentInfo.label}</span>
                        </div>
                      </div>

                      {/* AI Executive Summary */}
                      {ticket.summary && (
                        <div style={{
                          fontSize: '13px',
                          color: '#475569',
                          fontStyle: 'italic',
                          borderLeft: '3px solid #c084fc',
                          paddingLeft: '10px',
                          marginTop: '6px',
                          lineHeight: '1.5'
                        }}>
                          "{ticket.summary}"
                        </div>
                      )}

                      {/* Cluster Reason Insight */}
                      {ticket.cluster_reason && (
                        <div style={{
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          color: '#92400e',
                          marginTop: '8px'
                        }}>
                          <strong>Clustering Correlation:</strong> {ticket.cluster_reason}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Reply to Customer Section */}
                <div style={{
                  marginTop: '16px',
                  borderRadius: '10px',
                  border: '1px solid #bfdbfe',
                  backgroundColor: '#f8fafc',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}></span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>
                        Reply to Customer
                      </span>
                    </div>
                    {ticket.agent_reply_at && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                        Yes Last replied: {new Date(ticket.agent_reply_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {ticket.agent_reply && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #dbeafe',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      color: '#1e40af',
                      marginBottom: '10px',
                      whiteSpace: 'pre-line'
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#3b82f6', marginBottom: '4px' }}>
                        Current Published Reply:
                      </div>
                      {ticket.agent_reply}
                    </div>
                  )}

                  {ticket.status === 'Open' ? (
                    <div>
                      <textarea
                        rows={2}
                        placeholder="Draft technical reply to send to the customer..."
                        value={replyDrafts[ticket.id] || ''}
                        onChange={(e) => handleReplyChange(ticket.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          fontSize: '13px',
                          lineHeight: '1.4',
                          outline: 'none',
                          boxSizing: 'border-box',
                          resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleSendReply(ticket.id, false)}
                          disabled={replyingTicketId === ticket.id || !replyDrafts[ticket.id]?.trim()}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: replyingTicketId === ticket.id || !replyDrafts[ticket.id]?.trim() ? 'not-allowed' : 'pointer',
                            opacity: replyingTicketId === ticket.id || !replyDrafts[ticket.id]?.trim() ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{replyingTicketId === ticket.id ? '' : ''}</span>
                          <span>Send Reply</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply(ticket.id, true)}
                          disabled={replyingTicketId === ticket.id || !replyDrafts[ticket.id]?.trim()}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: replyingTicketId === ticket.id || !replyDrafts[ticket.id]?.trim() ? 'not-allowed' : 'pointer',
                            opacity: replyingTicketId === ticket.id || !replyDrafts[ticket.id]?.trim() ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Yes</span>
                          <span>Reply & Mark Resolved</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                      Ticket is resolved. To send an additional reply, re-open this ticket.
                    </div>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div style={{
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '14px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {ticket.status === 'Resolved' && ticket.resolved_at ? (
                      <span>Resolved on {new Date(ticket.resolved_at).toLocaleDateString()}</span>
                    ) : (
                      <span>Assigned to queue based on AI routing rules</span>
                    )}
                  </div>

                  {ticket.status === 'Open' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {ticket.is_cluster_parent && (
                        <button
                          onClick={() => handleResolveCluster(ticket.id)}
                          disabled={resolvingClusterId === ticket.id}
                          style={{
                            padding: '7px 16px',
                            backgroundColor: '#d97706',
                            color: '#ffffff',
                            borderRadius: '7px',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: 'none',
                            cursor: resolvingClusterId === ticket.id ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 2px rgba(217, 119, 6, 0.25)',
                          }}
                        >
                          <span></span>
                          <span>{resolvingClusterId === ticket.id ? 'Resolving Cluster...' : 'Bulk Resolve Cluster'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleResolve(ticket.id)}
                        style={{
                          padding: '7px 16px',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          borderRadius: '7px',
                          fontSize: '13px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <Icon name="check" size={14} color="#ffffff" />
                        <span>Mark Resolved</span>
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="check" size={14} color="#059669" />
                      <span>Case Closed</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal for Full Screenshot Viewing */}
      {viewingScreenshot && (
        <div
          onClick={() => setViewingScreenshot(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="image" size={16} color="#2563eb" />
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                  Customer Attached Screenshot Preview
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={viewingScreenshot}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2563eb',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff'
                  }}
                >
                  Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setViewingScreenshot(null)}
                  style={{
                    border: 'none',
                    background: '#e2e8f0',
                    color: '#475569',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icon name="close" size={14} color="#475569" />
                </button>
              </div>
            </div>
            <div style={{ padding: '16px', overflow: 'auto', textAlign: 'center', backgroundColor: '#0b0f19' }}>
              <img
                src={viewingScreenshot}
                alt="Customer Attached Screenshot Full Size"
                style={{
                  maxWidth: '100%',
                  maxHeight: '78vh',
                  objectFit: 'contain',
                  borderRadius: '6px'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
