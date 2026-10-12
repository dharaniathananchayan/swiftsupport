import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSlaPolicies, updateSlaPolicy, getUsers, updateUserRole, getTickets, assignTicket } from '../services/api';
import Icon from './Icon';

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

const AdminSettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'sla' | 'users'
  const [slaPolicies, setSlaPolicies] = useState([]);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState({});
  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [filterAgent, setFilterAgent] = useState('ALL');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

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
    } catch (err) {
      alert('Failed to update user role: ' + (err.response?.data?.detail || err.message));
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

  if (!isOpen) return null;

  const agentsList = users.filter(u => u.role === 'agent' || u.role === 'admin');

  // Filtered tickets in admin overview
  const filteredTickets = tickets.filter(t => {
    if (filterAgent === 'UNASSIGNED') return !t.assigned_agent_id;
    if (filterAgent !== 'ALL') return t.assigned_agent_id === parseInt(filterAgent, 10);
    return true;
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '920px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}></span>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
                Admin Operations Console
              </h2>
              <p style={{ fontSize: '12px', margin: 0, color: '#94a3b8' }}>
                Monitor ticket assignments, inspect lifecycle progress, and configure SLA policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Tab navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          padding: '0 24px',
          alignItems: 'center',
        }}>
          <button
            onClick={() => setActiveTab('tickets')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'tickets' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'tickets' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span></span> Ticket Assignments & Progress Tracking
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'sla' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'sla' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span></span> SLA Policies
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'users' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'users' ? '#2563eb' : '#64748b',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span></span> Team Members & RBAC
          </button>

          <Link
            to="/admin/analytics"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              color: '#ea580c',
              fontSize: '12px',
              fontWeight: '700',
              textDecoration: 'none',
              borderRadius: '8px',
              backgroundColor: '#fff7ed',
              border: '1px solid #fed7aa',
            }}
          >
            <Icon name="metrics" size={13} color="#ea580c" />
            <span>System Analytics ↗</span>
          </Link>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Loading operational records...
            </div>
          ) : activeTab === 'tickets' ? (
            <div>
              {/* Filter Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a' }}>
                    Agent Assignment & Detailed Ticket Tracking
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Inspect which agent is assigned to each inquiry, update owners, and view milestone progress.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Filter by Agent:</label>
                  <select
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                    }}
                  >
                    <option value="ALL">All Support Staff ({tickets.length})</option>
                    <option value="UNASSIGNED">Unassigned Tickets</option>
                    {agentsList.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name} ({a.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tickets Table with Assignment & Progress Action */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Ticket</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Customer</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Assigned Agent</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Status</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Progress Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t) => {
                      const isResolved = t.status === 'Resolved';
                      const assignedUser = t.assigned_agent || agentsList.find(a => a.id === t.assigned_agent_id);

                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: '800', color: '#2563eb', fontSize: '12px' }}>#{t.id}</span>
                              <span style={{ fontWeight: '600', color: '#0f172a', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.subject}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Dept: {t.department || 'Processing'} • Priority: {t.priority || 'Pending'}
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{t.customer_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{t.customer_email}</div>
                          </td>

                          {/* Interactive Assigned Agent Dropdown */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <select
                                value={t.assigned_agent_id || ''}
                                onChange={(e) => handleAssignTicket(t.id, e.target.value)}
                                disabled={assigningId === t.id}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '8px',
                                  border: `1.5px solid ${t.assigned_agent_id ? '#93c5fd' : '#fde68a'}`,
                                  backgroundColor: t.assigned_agent_id ? '#eff6ff' : '#fffbeb',
                                  color: t.assigned_agent_id ? '#1e40af' : '#92400e',
                                  fontWeight: '600',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value=""> Unassigned</option>
                                {agentsList.map(a => (
                                  <option key={a.id} value={a.id}>
                                     {a.full_name} ({a.role})
                                  </option>
                                ))}
                              </select>
                              {assigningId === t.id && <span style={{ fontSize: '11px' }}></span>}
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: isResolved ? '#ecfdf5' : '#eff6ff',
                              color: isResolved ? '#065f46' : '#1e40af',
                              border: `1px solid ${isResolved ? '#a7f3d0' : '#bfdbfe'}`,
                            }}>
                              {t.status}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedTicketDetail(t)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: selectedTicketDetail?.id === t.id ? '#2563eb' : '#ffffff',
                                color: selectedTicketDetail?.id === t.id ? '#ffffff' : '#334155',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              Inspect Timeline 
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Detailed Progress Tracking Modal/Card for Selected Ticket */}
              {selectedTicketDetail && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: '#2563eb', fontSize: '14px' }}>
                          #{selectedTicketDetail.id}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                          {selectedTicketDetail.subject}
                        </h4>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Submitted by <strong>{selectedTicketDetail.customer_name}</strong> ({selectedTicketDetail.customer_email})
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedTicketDetail(null)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#64748b',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Close Tracker x
                    </button>
                  </div>

                  {/* Multi-Stage Visual Lifecycle Progression Tracker */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '16px',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '14px' }}>
                      Lifecycle Milestone Milestones
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', position: 'relative' }}>
                      {/* Milestone 1: Ingestion */}
                      <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}></div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#065f46' }}>1. Created</div>
                        <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                          {new Date(selectedTicketDetail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Milestone 2: AI Classification */}
                      <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: selectedTicketDetail.department ? '#f5f3ff' : '#f8fafc',
                        border: `1px solid ${selectedTicketDetail.department ? '#ddd6fe' : '#e2e8f0'}`,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}></div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: selectedTicketDetail.department ? '#6d28d9' : '#64748b' }}>
                          2. AI Classified
                        </div>
                        <div style={{ fontSize: '10px', color: '#7c3aed', marginTop: '2px' }}>
                          {selectedTicketDetail.department || 'Enriching...'}
                        </div>
                      </div>

                      {/* Milestone 3: Agent Assignment & Support Reply */}
                      <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: selectedTicketDetail.agent_reply ? '#eff6ff' : selectedTicketDetail.assigned_agent_id ? '#fffbeb' : '#f8fafc',
                        border: `1px solid ${selectedTicketDetail.agent_reply ? '#bfdbfe' : selectedTicketDetail.assigned_agent_id ? '#fde68a' : '#e2e8f0'}`,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}></div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: selectedTicketDetail.agent_reply ? '#1d4ed8' : selectedTicketDetail.assigned_agent_id ? '#b45309' : '#64748b',
                        }}>
                          3. Support Reply
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                          {selectedTicketDetail.agent_reply ? 'Replied' : selectedTicketDetail.assigned_agent_id ? 'Assigned' : 'Unassigned'}
                        </div>
                      </div>

                      {/* Milestone 4: Resolution */}
                      <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: selectedTicketDetail.status === 'Resolved' ? '#ecfdf5' : '#f8fafc',
                        border: `1px solid ${selectedTicketDetail.status === 'Resolved' ? '#a7f3d0' : '#e2e8f0'}`,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>Yes</div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: selectedTicketDetail.status === 'Resolved' ? '#065f46' : '#94a3b8',
                        }}>
                          4. Resolution
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                          {selectedTicketDetail.resolved_at ? new Date(selectedTicketDetail.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary & Replies Log */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>AI Copilot Summary:</div>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        {selectedTicketDetail.summary || 'Summary generating during classification...'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Technical Support Response:</div>
                      <div style={{ fontSize: '13px', color: selectedTicketDetail.agent_reply ? '#1e40af' : '#94a3b8' }}>
                        {selectedTicketDetail.agent_reply || 'No agent reply published yet.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'sla' ? (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a' }}>
                  Resolution Time Targets (Hours)
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  When tickets are classified by the AI Engine, their SLA deadline is dynamically calculated based on these policies.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {slaPolicies.map((policy) => {
                  const priorityColors = {
                    High: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
                    Medium: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
                    Low: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
                    Default: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
                  };
                  const colors = priorityColors[policy.priority] || priorityColors.Default;
                  const isCurrentSaving = saveStatus?.priority === policy.priority;

                  return (
                    <div
                      key={policy.priority}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}>
                          {policy.priority} Priority
                        </span>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {policy.description}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="1"
                            max="720"
                            value={editingPolicy[policy.priority] || ''}
                            onChange={(e) => handleSlaChange(policy.priority, e.target.value)}
                            style={{
                              width: '64px',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: '600',
                            }}
                          />
                          <span style={{ fontSize: '12px', color: '#64748b' }}>hrs</span>
                        </div>

                        <button
                          onClick={() => saveSlaPolicy(policy.priority)}
                          disabled={isCurrentSaving}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            backgroundColor: isCurrentSaving ? '#94a3b8' : '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: isCurrentSaving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isCurrentSaving ? 'Saving...' : 'Update'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a' }}>
                  User Accounts & Role Permissions
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Control whether each team member has Customer, Support Agent, or Admin privileges.
                </p>
              </div>

              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Email</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0f172a' }}>
                          {u.full_name}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="customer">Customer</option>
                            <option value="agent">Support Agent</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
