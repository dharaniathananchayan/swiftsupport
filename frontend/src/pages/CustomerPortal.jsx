import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicket, getTickets, getTicket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

const QUICK_TOPICS = [
  { label: 'Login & Access', subject: 'Cannot access my account credentials' },
  { label: 'Billing & Invoices', subject: 'Discrepancy on recent subscription charge' },
  { label: 'Shipping & Delivery', subject: 'Tracking status update request' },
  { label: 'Technical Bug', subject: 'System error encountered when loading reports' },
];

const CustomerPortal = ({ initialTab = 'submit' }) => {
  const navigate = useNavigate();
  const { user, isCustomer } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // 'submit' | 'track'
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [viewingScreenshot, setViewingScreenshot] = useState(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Form State
  const [formData, setFormData] = useState({
    customer_name: user?.full_name || '',
    customer_email: user?.email || '',
    subject: '',
    description: '',
    screenshot_url: ''
  });
  const [status, setStatus] = useState(null); // 'submitting', 'success', 'error'
  const [createdTicketId, setCreatedTicketId] = useState(null);

  // Ticket Tracking State
  const [trackSearchId, setTrackSearchId] = useState('');
  const [searchedTicket, setSearchedTicket] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  // Customer Ticket History
  const [myTickets, setMyTickets] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        customer_name: prev.customer_name || user.full_name || '',
        customer_email: prev.customer_email || user.email || ''
      }));
    }
  }, [user]);

  const fetchMyTickets = async () => {
    setLoadingHistory(true);
    try {
      const data = await getTickets();
      const filtered = user?.role === 'customer'
        ? data
        : data.filter(t => t.customer_email === (formData.customer_email || user?.email));
      setMyTickets(filtered.sort((a, b) => b.id - a.id));
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'track') {
      fetchMyTickets();
    }
  }, [activeTab, user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const applyQuickTopic = (topic) => {
    setFormData(prev => ({ ...prev, subject: topic.subject }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please select a smaller screenshot.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setScreenshotPreview(base64);
      setFormData(prev => ({ ...prev, screenshot_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshotPreview(null);
    setFormData(prev => ({ ...prev, screenshot_url: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const payload = {
        ...formData,
        customer_name: formData.customer_name || user?.full_name || 'Customer',
        customer_email: formData.customer_email || user?.email || 'customer@example.com'
      };
      const created = await createTicket(payload);
      setCreatedTicketId(created.id);
      setStatus('success');
      setFormData(prev => ({ ...prev, subject: '', description: '', screenshot_url: '' }));
      setScreenshotPreview(null);
      // Pre-load tracking for the newly created ticket
      setSearchedTicket(created);
    } catch (error) {
      console.error('Error submitting ticket:', error);
      setStatus('error');
    }
  };

  const handleSearchTicket = async (e) => {
    if (e) e.preventDefault();
    const cleanId = trackSearchId.trim().replace(/^#/, '');
    if (!cleanId) return;

    setSearching(true);
    setSearchError('');
    try {
      const ticket = await getTicket(cleanId);
      setSearchedTicket(ticket);
    } catch (err) {
      setSearchedTicket(null);
      setSearchError(`Ticket #${cleanId} was not found. Please verify the ticket ID and try again.`);
    } finally {
      setSearching(false);
    }
  };

  // Helper to render tracking progression steps
  const renderStatusTracker = (ticket) => {
    const isResolved = ticket.status === 'Resolved';
    const hasAgentReply = Boolean(ticket.agent_reply);

    // 3 progressive steps:
    // Step 1: Ticket Submitted
    // Step 2: Under Technical Review (or Reply Received)
    // Step 3: Resolved
    return (
      <div style={{
        margin: '16px 0 20px 0',
        padding: '16px 20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '12px' }}>
          Live Support Progression
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {/* Track Line */}
          <div style={{
            position: 'absolute',
            left: '20px',
            right: '20px',
            top: '14px',
            height: '3px',
            backgroundColor: '#e2e8f0',
            zIndex: 1
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#10b981',
              width: isResolved ? '100%' : hasAgentReply ? '50%' : '15%',
              transition: 'width 0.4s ease'
            }} />
          </div>

          {/* Step 1: Submitted */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
            }}>
              Yes
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>Submitted</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Step 2: Technical Review & Reply */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: hasAgentReply || isResolved ? '#10b981' : '#3b82f6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
            }}>
              {hasAgentReply || isResolved ? 'Yes' : ''}
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: hasAgentReply || isResolved ? '#0f172a' : '#2563eb', marginTop: '6px' }}>
              {hasAgentReply ? 'Support Replied' : 'Technical Review'}
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {ticket.department || 'In Queue'}
            </span>
          </div>

          {/* Step 3: Resolved */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: isResolved ? '#10b981' : '#cbd5e1',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 'bold',
            }}>
              {isResolved ? 'Yes' : '3'}
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: isResolved ? '#059669' : '#94a3b8', marginTop: '6px' }}>
              Resolution
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {isResolved ? 'Completed' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render the dedicated "Reply from Technical Support" section
  const renderSupportReply = (ticket) => {
    if (ticket.agent_reply) {
      return (
        <div style={{
          marginTop: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '12px',
          border: '1.5px solid #93c5fd',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                
              </div>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a' }}>
                  Reply from Technical Support
                </span>
                <div style={{ fontSize: '11px', color: '#3b82f6' }}>
                  Official support engineer response
                </div>
              </div>
            </div>

            {ticket.agent_reply_at && (
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                {new Date(ticket.agent_reply_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>

          <div style={{
            fontSize: '13px',
            color: '#1e293b',
            lineHeight: '1.6',
            backgroundColor: '#ffffff',
            padding: '14px 16px',
            borderRadius: '8px',
            border: '1px solid #bfdbfe',
            whiteSpace: 'pre-line'
          }}>
            {ticket.agent_reply}
          </div>
        </div>
      );
    }

    return (
      <div style={{
        marginTop: '16px',
        backgroundColor: '#fffbeb',
        borderRadius: '10px',
        border: '1px solid #fde68a',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#fef3c7',
          color: '#d97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          flexShrink: 0
        }}>
          <Icon name="clock" size={14} color="#d97706" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
            Awaiting Technical Support Reply
          </div>
          <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
            Your request has been routed to our technical support engineers. We are currently evaluating your issue and will post an update here shortly.
          </div>
        </div>
      </div>
    );
  };

  const renderScreenshotThumbnail = (imageUrl, label = 'Attached Screenshot') => {
    if (!imageUrl) return null;
    return (
      <div style={{
        marginTop: '12px',
        marginBottom: '12px',
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
            src={imageUrl}
            alt={label}
            onClick={() => setViewingScreenshot(imageUrl)}
            style={{
              width: '64px',
              height: '44px',
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
              <span>{label}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Click thumbnail to expand full resolution image
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setViewingScreenshot(imageUrl)}
          style={{
            padding: '5px 12px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
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
          <Icon name="search" size={12} color="#2563eb" />
          <span>View Screenshot</span>
        </button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '840px', margin: '36px auto', padding: '0 20px' }}>
      {/* Dynamic Hero Header based on Route / Mode */}
      {activeTab === 'submit' ? (
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '10px'
          }}>
            <Icon name="portal" size={13} color="#1d4ed8" />
            <span>Support Helpdesk</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.6px', margin: '0 0 8px 0' }}>
            Submit Support Ticket
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Submit inquiries and bug reports with optional screenshot attachments. Our automated AI routing assigns issues directly to specialized agents.
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '10px'
          }}>
            <Icon name="clock" size={13} color="#1d4ed8" />
            <span>Live Resolution Tracking</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.6px', margin: '0 0 8px 0' }}>
            Track Tickets & Support Replies
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Monitor lifecycle progress in real time and read direct replies and solutions provided by our technical team.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: TICKET SUBMISSION                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'submit' && (
        <div>
          {/* Submission Success Banner */}
          {status === 'success' && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #a7f3d0',
              padding: '22px',
              marginBottom: '22px',
              background: 'linear-gradient(to bottom, #ffffff, #f0fdf4)',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  border: '1px solid #a7f3d0'
                }}>
                  <Icon name="check" size={18} color="#059669" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#065f46', margin: 0 }}>
                    Ticket #{createdTicketId} Submitted Successfully!
                  </h3>
                  <p style={{ fontSize: '13px', color: '#047857', marginTop: '4px', lineHeight: '1.5' }}>
                    Your inquiry has been placed into our technical support queue. You can track this ticket's status and view support replies below.
                  </p>
                  
                  <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setTrackSearchId(String(createdTicketId));
                        navigate('/track');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        fontWeight: '600',
                        fontSize: '12px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon name="clock" size={13} color="#ffffff" />
                      <span>Track Ticket #{createdTicketId} Now</span>
                    </button>
                    <button
                      onClick={() => setStatus(null)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Submit Another Ticket
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ticket Submission Form */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            padding: '28px',
          }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Customer Contact Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Your Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    required
                    type="text"
                    name="customer_name"
                    placeholder="e.g. Sarah Jenkins"
                    value={formData.customer_name}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    required
                    type="email"
                    name="customer_email"
                    placeholder="e.g. sarah@company.com"
                    value={formData.customer_email}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Quick Topics */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Common Inquiries (click to prefill subject):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {QUICK_TOPICS.map((topic, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => applyQuickTopic(topic)}
                      style={{
                        fontSize: '12px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {topic.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Subject / Summary <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  name="subject"
                  placeholder="e.g. Payment gateway is returning 500 error during checkout"
                  value={formData.subject}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Detailed Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  required
                  name="description"
                  rows={4}
                  placeholder="Please describe what occurred or what assistance you need from technical support..."
                  value={formData.description}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    outline: 'none',
                    lineHeight: '1.5',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Screenshot Attachment */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="image" size={14} color="#64748b" />
                    <span>Include Screenshot</span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>(Optional — PNG, JPG, WebP up to 5MB)</span>
                  </span>
                  {screenshotPreview && (
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Remove Screenshot
                    </button>
                  )}
                </label>

                {!screenshotPreview ? (
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    borderRadius: '10px',
                    border: '2px dashed #cbd5e1',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '8px'
                    }}>
                      <Icon name="image" size={18} color="#2563eb" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb' }}>
                      Click to upload an error screenshot or image
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Helps technical agents diagnose UI bugs and error logs faster
                    </span>
                  </label>
                ) : (
                  <div style={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                  }}>
                    <img
                      src={screenshotPreview}
                      alt="Ticket Screenshot Preview"
                      style={{
                        width: '120px',
                        height: '75px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                        Screenshot Attached
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600', marginTop: '2px' }}>
                        Ready to attach with this ticket submission
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: status === 'submitting' ? 0.8 : 1,
                    border: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {status === 'submitting' ? (
                    <>
                      <span></span>
                      <span>Submitting Inquiry...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Ticket</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TICKET TRACKING & REPLY FROM TECHNICAL SUPPORT                     */}
      {/* ========================================================================= */}
      {activeTab === 'track' && (
        <div>
          {/* Quick Ticket Lookup Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '20px 22px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <form onSubmit={handleSearchTicket} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Enter Ticket #ID (e.g. 101 or #101) to track status & read technical reply..."
                  value={trackSearchId}
                  onChange={(e) => setTrackSearchId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={searching || !trackSearchId.trim()}
                style={{
                  padding: '11px 20px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: searching || !trackSearchId.trim() ? 'not-allowed' : 'pointer',
                  opacity: searching || !trackSearchId.trim() ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{searching ? '' : ''}</span>
                <span>Track Ticket</span>
              </button>
            </form>

            {searchError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: '8px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span></span>
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Searched Ticket Result Card */}
          {searchedTicket && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                   Search Result for Ticket #{searchedTicket.id}
                </span>
                <button
                  onClick={() => setSearchedTicket(null)}
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Clear Result
                </button>
              </div>

              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #cbd5e1',
                padding: '22px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '800', color: '#2563eb', fontSize: '15px' }}>
                      #{searchedTicket.id}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {searchedTicket.subject}
                    </h3>
                  </div>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: searchedTicket.status === 'Resolved' ? '#ecfdf5' : '#eff6ff',
                    color: searchedTicket.status === 'Resolved' ? '#065f46' : '#1e40af',
                    border: `1px solid ${searchedTicket.status === 'Resolved' ? '#a7f3d0' : '#bfdbfe'}`
                  }}>
                    {searchedTicket.status}
                  </span>
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                  {searchedTicket.description}
                </p>

                {/* Customer Attached Screenshot */}
                {renderScreenshotThumbnail(searchedTicket.screenshot_url)}

                {/* Live Progression Tracker */}
                {renderStatusTracker(searchedTicket)}

                {/* Dedicated Reply from Technical Support */}
                {renderSupportReply(searchedTicket)}
              </div>
            </div>
          )}

          {/* Customer's Ticket List Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              Your Tracked Tickets ({myTickets.length})
            </h3>
            <button
              onClick={fetchMyTickets}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icon name="refresh" size={13} color="#475569" />
              <span>Refresh Tracking</span>
            </button>
          </div>

          {/* Tickets List */}
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Loading your ticket records...
            </div>
          ) : myTickets.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px dashed #cbd5e1',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <Icon name="clock" size={32} color="#94a3b8" />
              </div>
              <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>No Active Tickets</div>
              <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>
                You have not submitted any inquiries yet or are not logged in.
              </p>
              <button
                onClick={() => navigate('/')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Submit a Support Ticket
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myTickets.map((ticket) => {
                const isResolved = ticket.status === 'Resolved';
                return (
                  <div
                    key={ticket.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: '#2563eb', fontSize: '14px' }}>
                          #{ticket.id}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                          {ticket.subject}
                        </h4>
                      </div>

                      <span style={{
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: isResolved ? '#ecfdf5' : '#eff6ff',
                        color: isResolved ? '#065f46' : '#1e40af',
                        border: `1px solid ${isResolved ? '#a7f3d0' : '#bfdbfe'}`
                      }}>
                        {ticket.status}
                      </span>
                    </div>

                    {/* Inquiry Description */}
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                      {ticket.description}
                    </p>

                    {/* Customer Attached Screenshot */}
                    {renderScreenshotThumbnail(ticket.screenshot_url)}

                    {/* Live Tracking Progression Bar */}
                    {renderStatusTracker(ticket)}

                    {/* Prominent Section: Reply from Technical Support */}
                    {renderSupportReply(ticket)}

                    {/* Footer Details */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#64748b',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '10px',
                      marginTop: '14px'
                    }}>
                      <span>Submitted on {new Date(ticket.created_at).toLocaleDateString()}</span>
                      {ticket.resolved_at && (
                        <span style={{ color: '#059669', fontWeight: '600' }}>
                          Resolved on {new Date(ticket.resolved_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  Attached Screenshot Preview
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
                alt="Attached Screenshot Full Size"
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

export default CustomerPortal;
