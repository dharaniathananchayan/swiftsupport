import React, { useState, useEffect } from 'react';
import { 
  getSlaPolicies, 
  updateSlaPolicy, 
  getUsers, 
  updateUserRole, 
  getTickets, 
  assignTicket, 
  autoAssignTicket,
  updateUserProfile 
} from '../services/api';
import Icon from '../components/Icon';
import AdminAnalyticsPage from './AdminAnalyticsPage';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

const DEPARTMENTS = ['Technical', 'Billing', 'Sales', 'Account', 'Shipping'];

const AdminConsolePage = () => {
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'staff' | 'sla' | 'users'
  const [slaPolicies, setSlaPolicies] = useState([]);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState({});
  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [autoAssigningId, setAutoAssigningId] = useState(null);
  const [filterAgent, setFilterAgent] = useState('ALL');
  const [viewingScreenshot, setViewingScreenshot] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policiesData, usersData, ticketsData] = await Promise.all([
        getSlaPolicies(),
        getUsers(),
        getTickets(),
      ]);
      setSlaPolicies(policiesData);
      setUsers(usersData);
      setTickets(ticketsData);

      const policyMap = {};
      policiesData.forEach(p => {
        policyMap[p.priority] = p.target_hours;
      });
      setEditingPolicy(policyMap);
    } catch (err) {
      console.error('Failed to load admin settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSlaChange = (priority, hours) => {
    setEditingPolicy(prev => ({
      ...prev,
      [priority]: parseInt(hours, 10) || 1,
    }));
  };

  const saveSlaPolicy = async (priority) => {
    setSaveStatus({ priority, type: 'saving' });
    try {
      const hours = editingPolicy[priority];
      await updateSlaPolicy(priority, {
        target_hours: hours,
        description: `Target resolution within ${hours} hours`,
      });
      setSaveStatus({ priority, type: 'success', message: 'Saved!' });
      setTimeout(() => setSaveStatus(null), 3000);
      loadData();
    } catch (err) {
      setSaveStatus({ priority, type: 'error', message: err.message || 'Failed' });
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showNotification('User role updated successfully');
    } catch (err) {
      alert('Failed to update user role: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleProfileChange = async (userId, fields) => {
    try {
      const updated = await updateUserProfile(userId, fields);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
      showNotification('Agent settings saved successfully');
    } catch (err) {
      alert('Failed to update agent details: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAutoAssign = async (ticketId) => {
    setAutoAssigningId(ticketId);
    try {
      const updated = await autoAssignTicket(ticketId);
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
      if (selectedTicketDetail?.id === ticketId) {
        setSelectedTicketDetail(updated);
      }
      const agentName = updated.assigned_agent?.full_name || 'an available agent';
      showNotification(`Ticket #${ticketId} automatically assigned to ${agentName}!`);
    } catch (err) {
      alert('Auto-assignment failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAutoAssigningId(null);
    }
  };

  const handleAssignTicket = async (ticketId, agentId) => {
    setAssigningId(ticketId);
    try {
      const updated = await assignTicket(ticketId, agentId ? parseInt(agentId, 10) : null);
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
      if (selectedTicketDetail?.id === ticketId) {
        setSelectedTicketDetail(updated);
      }
    } catch (err) {
      console.error('Failed to assign ticket:', err);
      alert('Assignment error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAssigningId(null);
    }
  };

  const staffList = users.filter(u => u.role === 'agent' || u.role === 'admin');

  // Filtered tickets in admin overview
  const filteredTickets = tickets.filter(t => {
    if (filterAgent === 'UNASSIGNED') return !t.assigned_agent_id;
    if (filterAgent !== 'ALL') return t.assigned_agent_id === parseInt(filterAgent, 10);
    return true;
  });

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #334155'
        }}>
          <span></span>
          <span>{notification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: 'white',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)'
          }}>
            <Icon name="admin" size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#f8fafc', letterSpacing: '-0.3px' }}>
                Automated Dispatch & Admin Operations
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                background: '#7c3aed',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '12px',
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                Auto-Routing Engine
              </span>
            </div>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0', color: '#94a3b8' }}>
              Incoming tickets are automatically assigned to online agents matching department expertise and lowest workload.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        >
          <Icon name="refresh" size={15} color="#ffffff" />
          <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* Main Container Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          padding: '0 24px',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('tickets')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'tickets' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'tickets' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon name="ticket" size={16} color={activeTab === 'tickets' ? '#2563eb' : '#64748b'} />
            <span>Auto-Dispatched Tickets ({tickets.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'staff' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'staff' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon name="users" size={16} color={activeTab === 'staff' ? '#2563eb' : '#64748b'} />
            <span>Agent Availability & Skills ({staffList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'sla' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'sla' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon name="clock" size={16} color={activeTab === 'sla' ? '#2563eb' : '#64748b'} />
            <span>SLA Resolution Targets</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'users' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'users' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon name="shield" size={16} color={activeTab === 'users' ? '#2563eb' : '#64748b'} />
            <span>Accounts & RBAC</span>
          </button>
          <button
            onClick={() => setActiveTab('grafana')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'grafana' ? '2px solid #ea580c' : '2px solid transparent',
              color: activeTab === 'grafana' ? '#ea580c' : '#64748b',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon name="metrics" size={16} color={activeTab === 'grafana' ? '#ea580c' : '#64748b'} />
            <span>Grafana Dashboard</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '28px', backgroundColor: '#ffffff' }}>
          {loading && !tickets.length ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b', fontSize: '14px' }}>
              <span className="pulse-dot" style={{ backgroundColor: '#2563eb', display: 'inline-block', marginBottom: '8px' }} />
              <div>Loading console records...</div>
            </div>
          ) : null}

          {/* TAB 1: AUTO-DISPATCHED TICKETS */}
          {activeTab === 'tickets' && (
            <div>
              {/* How it works info callout */}
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon name="lightning" size={20} color="#15803d" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#166534' }}>
                      Automated Workload & Department Dispatch Engine Active
                    </strong>
                    <div style={{ fontSize: '12.5px', color: '#15803d', marginTop: '2px' }}>
                      Tickets are auto-assigned when submitted by matching the AI-classified department, agent online status, and lowest current queue count.
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#15803d'
                }}>
                  <span className="pulse-dot" style={{ backgroundColor: '#22c55e' }} />
                  <span>Auto-Routing Active</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                    Live Ticket Queue & Auto-Assignment Roster
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    View real-time assigned agents, inspect lifecycle progress, or trigger instant AI re-routing.
                  </p>
                </div>

                {/* Agent Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Filter by Agent:</label>
                  <select
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                    }}
                  >
                    <option value="ALL">All Agents ({tickets.length} tickets)</option>
                    <option value="UNASSIGNED">Unassigned ({tickets.filter(t => !t.assigned_agent_id).length})</option>
                    {staffList.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({tickets.filter(t => t.assigned_agent_id === a.id).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tickets Table */}
              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                marginBottom: '28px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '70px' }}>ID</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700' }}>Subject & Customer</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '120px' }}>Department</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '90px' }}>Priority</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '100px' }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '220px' }}>Auto-Assigned Agent</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '190px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(t => {
                      const isResolved = t.status === 'Resolved';
                      return (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: selectedTicketDetail?.id === t.id ? '#eff6ff' : 'transparent',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '14px 16px', fontWeight: '700', color: '#2563eb' }}>
                            #{t.id}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>
                              {t.subject}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span> {t.customer_name || 'Anonymous Customer'}</span>
                              <span>•</span>
                              <span>{formatRelativeTime(t.created_at)}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1'
                            }}>
                               {t.department || 'Triage'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: t.priority === 'High' ? '#fee2e2' : t.priority === 'Medium' ? '#fef3c7' : '#f1f5f9',
                              color: t.priority === 'High' ? '#dc2626' : t.priority === 'Medium' ? '#d97706' : '#475569',
                            }}>
                              {t.priority}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: isResolved ? '#ecfdf5' : '#eff6ff',
                              color: isResolved ? '#059669' : '#2563eb',
                            }}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {t.assigned_agent ? (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  backgroundColor: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#15803d',
                                  fontWeight: '700'
                                }}>
                                  <Icon name="user" size={13} color="#15803d" />
                                  <span>{t.assigned_agent.full_name}</span>
                                </div>
                              ) : (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  backgroundColor: '#fff7ed',
                                  border: '1px solid #fed7aa',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#c2410c',
                                  fontWeight: '600'
                                }}>
                                  <Icon name="clock" size={13} color="#c2410c" />
                                  <span>Awaiting Auto-Dispatch</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {/* Auto-Dispatch Trigger Button */}
                              <button
                                onClick={() => handleAutoAssign(t.id)}
                                disabled={autoAssigningId === t.id}
                                title="Re-run automated matching based on department and current agent workloads"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #86efac',
                                  backgroundColor: '#f0fdf4',
                                  color: '#16a34a',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Icon name="lightning" size={13} color="#16a34a" />
                                <span>{autoAssigningId === t.id ? 'Routing...' : 'Auto-Route'}</span>
                              </button>

                              <button
                                onClick={() => setSelectedTicketDetail(selectedTicketDetail?.id === t.id ? null : t)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #bfdbfe',
                                  backgroundColor: selectedTicketDetail?.id === t.id ? '#2563eb' : '#eff6ff',
                                  color: selectedTicketDetail?.id === t.id ? '#ffffff' : '#2563eb',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Icon name="search" size={13} color={selectedTicketDetail?.id === t.id ? '#ffffff' : '#2563eb'} />
                                <span>{selectedTicketDetail?.id === t.id ? 'Close' : 'Inspect'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* TICKET TRACKING POPUP MODAL FOR ADMIN */}
              {selectedTicketDetail && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(5px)',
                  WebkitBackdropFilter: 'blur(5px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '24px',
                }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    maxWidth: '860px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    {/* Modal Header */}
                    <div style={{
                      padding: '20px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      color: 'white',
                      borderTopLeftRadius: '16px',
                      borderTopRightRadius: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon name="ticket" size={20} color="#60a5fa" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '800',
                              background: '#2563eb',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}>
                              Ticket #{selectedTicketDetail.id}
                            </span>
                            <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
                              Ticket Progress & Lifecycle Tracking
                            </h3>
                          </div>
                          <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                            "{selectedTicketDetail.subject}" — Customer: {selectedTicketDetail.customer_name || 'Anonymous'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedTicketDetail(null)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="close" size={16} color="#ffffff" />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div style={{ padding: '24px' }}>
                      {/* Top Assigned Agent Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '20px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                            Assigned Support Agent:
                          </span>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: selectedTicketDetail.assigned_agent ? '#ecfdf5' : '#fff7ed',
                            color: selectedTicketDetail.assigned_agent ? '#059669' : '#ea580c',
                            border: `1px solid ${selectedTicketDetail.assigned_agent ? '#bbf7d0' : '#fed7aa'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            {selectedTicketDetail.assigned_agent ? (
                              <>
                                <Icon name="user" size={12} color="#059669" />
                                <span>{selectedTicketDetail.assigned_agent.full_name}</span>
                              </>
                            ) : (
                              <>
                                <Icon name="clock" size={12} color="#ea580c" />
                                <span>Unassigned</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: selectedTicketDetail.priority === 'High' ? '#fee2e2' : selectedTicketDetail.priority === 'Medium' ? '#fef3c7' : '#f1f5f9',
                            color: selectedTicketDetail.priority === 'High' ? '#dc2626' : selectedTicketDetail.priority === 'Medium' ? '#d97706' : '#475569',
                          }}>
                            Priority: {selectedTicketDetail.priority}
                          </span>
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: selectedTicketDetail.status === 'Resolved' ? '#ecfdf5' : '#eff6ff',
                            color: selectedTicketDetail.status === 'Resolved' ? '#059669' : '#2563eb',
                          }}>
                            Status: {selectedTicketDetail.status}
                          </span>
                        </div>
                      </div>

                      {/* 4-Stage Lifecycle Stepper */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '14px',
                        marginBottom: '20px',
                      }}>
                        {/* Stage 1: Created */}
                        <div style={{
                          padding: '14px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #bbf7d0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="check" size={12} color="#ffffff" />
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>1. Ticket Created</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {selectedTicketDetail.created_at ? new Date(selectedTicketDetail.created_at).toLocaleString() : 'N/A'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600', marginTop: '4px' }}>
                            Customer submitted
                          </div>
                        </div>

                        {/* Stage 2: AI Classified & Dispatched */}
                        <div style={{
                          padding: '14px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: selectedTicketDetail.department ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: selectedTicketDetail.department ? '#22c55e' : '#94a3b8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selectedTicketDetail.department ? <Icon name="check" size={12} color="#ffffff" /> : <span style={{ fontSize: '11px', fontWeight: '800' }}>2</span>}
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>2. AI Classified</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {selectedTicketDetail.department ? `Dept: ${selectedTicketDetail.department}` : 'Pending triage'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600', marginTop: '4px' }}>
                            {selectedTicketDetail.assigned_agent ? `Routed to ${selectedTicketDetail.assigned_agent.full_name}` : 'Auto-routing...'}
                          </div>
                        </div>

                        {/* Stage 3: Support Response */}
                        <div style={{
                          padding: '14px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: selectedTicketDetail.agent_reply ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: selectedTicketDetail.agent_reply ? '#22c55e' : '#94a3b8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selectedTicketDetail.agent_reply ? <Icon name="check" size={12} color="#ffffff" /> : <span style={{ fontSize: '11px', fontWeight: '800' }}>3</span>}
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>3. Support Response</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {selectedTicketDetail.agent_reply_at ? new Date(selectedTicketDetail.agent_reply_at).toLocaleString() : 'Awaiting agent reply'}
                          </div>
                          <div style={{ fontSize: '11px', color: selectedTicketDetail.agent_reply ? '#16a34a' : '#d97706', fontWeight: '600', marginTop: '4px' }}>
                            {selectedTicketDetail.agent_reply ? 'Reply sent to customer' : 'Assigned agent in review'}
                          </div>
                        </div>

                        {/* Stage 4: Resolution */}
                        <div style={{
                          padding: '14px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: selectedTicketDetail.status === 'Resolved' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: selectedTicketDetail.status === 'Resolved' ? '#22c55e' : '#94a3b8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selectedTicketDetail.status === 'Resolved' ? <Icon name="check" size={12} color="#ffffff" /> : <span style={{ fontSize: '11px', fontWeight: '800' }}>4</span>}
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>4. Resolution</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {selectedTicketDetail.status === 'Resolved' ? (selectedTicketDetail.resolved_at ? new Date(selectedTicketDetail.resolved_at).toLocaleString() : 'Marked Resolved') : 'Open incident'}
                          </div>
                          <div style={{ fontSize: '11px', color: selectedTicketDetail.status === 'Resolved' ? '#16a34a' : '#64748b', fontWeight: '600', marginTop: '4px' }}>
                            {selectedTicketDetail.status === 'Resolved' ? 'Completed & Closed' : 'In progress'}
                          </div>
                        </div>
                      </div>

                      {/* Customer Description & Agent Reply Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Original Customer Message
                          </div>
                          <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                            {selectedTicketDetail.description}
                          </p>

                          {selectedTicketDetail.screenshot_url && (
                            <div style={{
                              marginTop: '12px',
                              padding: '8px 10px',
                              backgroundColor: '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                  src={selectedTicketDetail.screenshot_url}
                                  alt="Attached Screenshot"
                                  onClick={() => setViewingScreenshot(selectedTicketDetail.screenshot_url)}
                                  style={{
                                    width: '54px',
                                    height: '36px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    cursor: 'pointer'
                                  }}
                                />
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Icon name="image" size={12} color="#2563eb" />
                                    <span>Attached Screenshot</span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                                    Customer provided image
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setViewingScreenshot(selectedTicketDetail.screenshot_url)}
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: '#2563eb',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Icon name="search" size={11} color="#2563eb" />
                                <span>Preview</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Technical Agent Response
                          </div>
                          <p style={{ fontSize: '13px', color: selectedTicketDetail.agent_reply ? '#15803d' : '#94a3b8', margin: 0, lineHeight: 1.5, fontStyle: selectedTicketDetail.agent_reply ? 'normal' : 'italic' }}>
                            {selectedTicketDetail.agent_reply || 'No agent reply recorded yet.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div style={{
                      padding: '16px 24px',
                      borderTop: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      borderBottomLeftRadius: '16px',
                      borderBottomRightRadius: '16px',
                    }}>
                      <button
                        onClick={() => setSelectedTicketDetail(null)}
                        style={{
                          padding: '8px 20px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Close Tracking Window
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lightbox Modal for Full Screenshot Viewing in Admin */}
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
                    zIndex: 10000,
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
                          Customer Attached Screenshot
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
          )}

          {/* TAB 2: AGENT AVAILABILITY & SKILLS */}
          {activeTab === 'staff' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                  Support Agent Availability & Department Skills Roster
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  The auto-assignment engine routes tickets by matching the ticket's department to the agent's specialty, online availability, and active workload.
                </p>
              </div>

              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px', fontWeight: '700' }}>Support Agent</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '150px' }}>Availability Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '180px' }}>Department Specialty</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '140px' }}>Active Open Load</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700', width: '140px' }}>Max Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map(agent => {
                      const activeTicketsCount = tickets.filter(t => t.assigned_agent_id === agent.id && t.status !== 'Resolved').length;
                      const isOnline = agent.is_available !== false && agent.is_available !== 0;

                      return (
                        <tr key={agent.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '10px',
                                backgroundColor: agent.role === 'admin' ? '#f5f3ff' : '#eff6ff',
                                color: agent.role === 'admin' ? '#7c3aed' : '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '800',
                                fontSize: '13px',
                              }}>
                                {agent.full_name ? agent.full_name[0].toUpperCase() : 'A'}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: '#0f172a' }}>{agent.full_name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{agent.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Online Availability Toggle */}
                          <td style={{ padding: '14px 16px' }}>
                            <button
                              onClick={() => handleProfileChange(agent.id, { is_available: !isOnline })}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '20px',
                                border: `1px solid ${isOnline ? '#bbf7d0' : '#cbd5e1'}`,
                                backgroundColor: isOnline ? '#f0fdf4' : '#f8fafc',
                                color: isOnline ? '#15803d' : '#64748b',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isOnline ? '#22c55e' : '#94a3b8'
                              }} />
                              <span>{isOnline ? 'Online (Available)' : 'Offline (Away)'}</span>
                            </button>
                          </td>

                          {/* Department Selection */}
                          <td style={{ padding: '14px 16px' }}>
                            <select
                              value={agent.department || 'Technical'}
                              onChange={(e) => handleProfileChange(agent.id, { department: e.target.value })}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12.5px',
                                fontWeight: '700',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                cursor: 'pointer'
                              }}
                            >
                              {DEPARTMENTS.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </td>

                          {/* Active Open Tickets Load */}
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: '800',
                              backgroundColor: activeTicketsCount >= (agent.max_concurrent_tickets || 5) ? '#fee2e2' : '#eff6ff',
                              color: activeTicketsCount >= (agent.max_concurrent_tickets || 5) ? '#dc2626' : '#2563eb',
                              border: `1px solid ${activeTicketsCount >= (agent.max_concurrent_tickets || 5) ? '#fecaca' : '#bfdbfe'}`
                            }}>
                              {activeTicketsCount} active tickets
                            </span>
                          </td>

                          {/* Max Capacity */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={agent.max_concurrent_tickets || 5}
                                onChange={(e) => handleProfileChange(agent.id, { max_concurrent_tickets: parseInt(e.target.value, 10) || 5 })}
                                style={{
                                  width: '55px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  textAlign: 'center'
                                }}
                              />
                              <span style={{ fontSize: '11px', color: '#64748b' }}>max</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SLA RESOLUTION TARGETS */}
          {activeTab === 'sla' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                  Target Resolution Timeframes (Hours)
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Define the maximum allowable duration before a ticket breaches its SLA deadline.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {['High', 'Medium', 'Low'].map(priority => {
                  const currentHours = editingPolicy[priority] || '';
                  const status = saveStatus?.priority === priority ? saveStatus : null;

                  const badgeColors = {
                    High: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
                    Medium: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
                    Low: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
                  }[priority];

                  return (
                    <div
                      key={priority}
                      style={{
                        padding: '18px 20px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          backgroundColor: badgeColors.bg,
                          color: badgeColors.text,
                          border: `1px solid ${badgeColors.border}`,
                        }}>
                          {priority} Priority
                        </span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                            Resolution SLA Target
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Breach triggered after elapsed hours from submission
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            min="1"
                            max="720"
                            value={currentHours}
                            onChange={(e) => handleSlaChange(priority, e.target.value)}
                            style={{
                              width: '70px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              fontWeight: '700',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>hours</span>
                        </div>

                        <button
                          onClick={() => saveSlaPolicy(priority)}
                          disabled={status?.type === 'saving'}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {status?.type === 'saving' ? 'Saving...' : 'Save SLA'}
                        </button>

                        {status?.type === 'success' && (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>Yes Saved</span>
                        )}
                        {status?.type === 'error' && (
                          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>x {status.message}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TEAM ROLE MANAGEMENT (RBAC) */}
          {activeTab === 'users' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                  Team Accounts & RBAC Permissions
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Adjust roles between Customer, Support Agent, and Administrator to manage workspace access.
                </p>
              </div>

              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px', fontWeight: '700' }}>User</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700' }}>Email Address</th>
                      <th style={{ padding: '12px 16px', fontWeight: '700' }}>Assigned Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              backgroundColor: u.role === 'admin' ? '#f5f3ff' : u.role === 'agent' ? '#eff6ff' : '#ecfdf5',
                              color: u.role === 'admin' ? '#7c3aed' : u.role === 'agent' ? '#2563eb' : '#059669',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '800',
                              fontSize: '11px',
                            }}>
                              {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                            </div>
                            <span>{u.full_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: '700',
                              backgroundColor: '#ffffff',
                              color: u.role === 'admin' ? '#7c3aed' : u.role === 'agent' ? '#2563eb' : '#059669',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="customer">Customer</option>
                            <option value="agent">Support Agent</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: BUILT-IN GRAFANA DASHBOARD & PROMETHEUS TELEMETRY */}
          {activeTab === 'grafana' && (
            <div style={{ margin: '-28px', padding: '16px' }}>
              <AdminAnalyticsPage />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminConsolePage;
