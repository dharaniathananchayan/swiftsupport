import React, { useState, useEffect, useMemo } from 'react';
import { getTickets } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

const DEPARTMENT_COLORS = {
  Technical: '#8b5cf6',
  Billing: '#3b82f6',
  Sales: '#10b981',
  Account: '#f59e0b',
  Shipping: '#ec4899',
  General: '#64748b'
};

const PRIORITY_COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
};

// Clean SVG Pie Chart with interactive hover tooltips
function PieChart({ data, size = 260 }) {
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const total = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  if (total === 0) {
    return (
      <div style={{
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: '13px'
      }}>
        No categorized tickets yet
      </div>
    );
  }

  const radius = size / 2 - 16;
  const center = size / 2;

  let cumulativeAngle = 0;

  const slices = data.map((item) => {
    const fraction = item.value / total;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const x1 = center + radius * Math.sin(startAngle);
    const y1 = center - radius * Math.cos(startAngle);
    const x2 = center + radius * Math.sin(endAngle);
    const y2 = center - radius * Math.cos(endAngle);

    const largeArcFlag = fraction > 0.5 ? 1 : 0;

    // Full circle corner case
    const pathData = fraction >= 0.999
      ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius} Z`
      : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    const percentage = Math.round(fraction * 100);

    return {
      ...item,
      pathData,
      percentage,
      fraction,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => {
          const isHovered = hoveredSlice?.name === slice.name;
          return (
            <path
              key={idx}
              d={slice.pathData}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth="2.5"
              style={{
                cursor: 'pointer',
                transition: 'transform 0.2s, opacity 0.2s',
                transformOrigin: `${center}px ${center}px`,
                transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                opacity: hoveredSlice && !isHovered ? 0.6 : 1,
              }}
              onMouseEnter={() => setHoveredSlice(slice)}
              onMouseLeave={() => setHoveredSlice(null)}
            />
          );
        })}
        {/* Inner donut circle for clean modern aesthetic */}
        <circle cx={center} cy={center} r={radius * 0.55} fill="#ffffff" />
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          fill="#0f172a"
          style={{ fontSize: '20px', fontWeight: '900' }}
        >
          {hoveredSlice ? hoveredSlice.value : total}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          fill="#64748b"
          style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}
        >
          {hoveredSlice ? hoveredSlice.name : 'Total Tickets'}
        </text>
      </svg>

      {/* Legend Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '12px',
        marginTop: '16px',
        maxWidth: '380px'
      }}>
        {slices.map((slice, idx) => (
          <div
            key={idx}
            onMouseEnter={() => setHoveredSlice(slice)}
            onMouseLeave={() => setHoveredSlice(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: hoveredSlice?.name === slice.name ? '#f1f5f9' : 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
          >
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: slice.color,
              flexShrink: 0
            }} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
              {slice.name}
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b' }}>
              {slice.value} ({slice.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AgentAnalyticsPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'ALL' | '7D' | '30D'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets for agent analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Only consider tickets assigned to the logged-in agent
  const myAssignedTickets = useMemo(() => {
    if (!user) return [];
    return tickets.filter(t => t.assigned_agent_id === user.id);
  }, [tickets, user]);

  // Apply optional time filter
  const filteredTickets = useMemo(() => {
    if (timeFilter === 'ALL') return myAssignedTickets;
    const now = new Date();
    const days = timeFilter === '7D' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return myAssignedTickets.filter(t => new Date(t.created_at) >= cutoff);
  }, [myAssignedTickets, timeFilter]);

  // Metric Computations
  const stats = useMemo(() => {
    const totalAssigned = filteredTickets.length;
    const resolved = filteredTickets.filter(t => t.status === 'Resolved').length;
    const unresolved = totalAssigned - resolved;
    const resolutionRate = totalAssigned > 0 ? Math.round((resolved / totalAssigned) * 100) : 0;
    
    // SLA breaches or on-time
    const highPriorityUnresolved = filteredTickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length;

    // Categories (Department) Distribution
    const deptCount = {};
    filteredTickets.forEach(t => {
      const dept = t.department || 'Unassigned';
      deptCount[dept] = (deptCount[dept] || 0) + 1;
    });

    const categoryData = Object.keys(deptCount).map(dept => ({
      name: dept,
      value: deptCount[dept],
      color: DEPARTMENT_COLORS[dept] || DEPARTMENT_COLORS.General
    })).sort((a, b) => b.value - a.value);

    // Priority Distribution
    const priorityCount = { High: 0, Medium: 0, Low: 0 };
    filteredTickets.forEach(t => {
      if (priorityCount[t.priority] !== undefined) {
        priorityCount[t.priority]++;
      }
    });

    const priorityData = Object.keys(priorityCount).map(p => ({
      name: p,
      value: priorityCount[p],
      color: PRIORITY_COLORS[p]
    }));

    return {
      totalAssigned,
      resolved,
      unresolved,
      resolutionRate,
      highPriorityUnresolved,
      categoryData,
      priorityData
    };
  }, [filteredTickets]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px', margin: 0 }}>
              Agent Performance & Ticket Analytics
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
              View Analytics
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', margin: 0 }}>
            Personalized metrics for tickets assigned to <strong>{user?.full_name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Time range switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1'
          }}>
            {['ALL', '30D', '7D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: timeFilter === tf ? '#ffffff' : 'transparent',
                  color: timeFilter === tf ? '#0f172a' : '#64748b',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: timeFilter === tf ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {tf === 'ALL' ? 'All Time' : tf === '30D' ? 'Last 30 Days' : 'Last 7 Days'}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadData(true)}
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
              cursor: refreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <Icon name="refresh" size={14} color="#334155" className={refreshing ? 'spinner' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b', fontSize: '14px' }}>
          <span className="pulse-dot" style={{ backgroundColor: '#2563eb', display: 'inline-block', marginBottom: '8px' }} />
          <div>Computing agent ticket analytics...</div>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '28px'
          }}>
            {/* Total Assigned */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Assigned Tickets
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="ticket" size={16} color="#2563eb" />
                </div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', marginTop: '6px' }}>
                {stats.totalAssigned}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Tickets in personal queue
              </div>
            </div>

            {/* Resolved Tickets */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #bbf7d0',
              background: 'linear-gradient(to bottom right, #ffffff, #f0fdf4)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>
                  Resolved Tickets
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="check" size={16} color="#15803d" />
                </div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#16a34a', marginTop: '6px' }}>
                {stats.resolved}
              </div>
              <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px', fontWeight: '600' }}>
                {stats.resolutionRate}% resolution rate
              </div>
            </div>

            {/* Unresolved / Open Tickets */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #fed7aa',
              background: 'linear-gradient(to bottom right, #ffffff, #fff7ed)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#c2410c', textTransform: 'uppercase' }}>
                  Unresolved Tickets
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="clock" size={16} color="#c2410c" />
                </div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#ea580c', marginTop: '6px' }}>
                {stats.unresolved}
              </div>
              <div style={{ fontSize: '12px', color: '#9a3412', marginTop: '4px' }}>
                Currently awaiting resolution
              </div>
            </div>

            {/* High Priority Pending */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid #fecaca',
              background: 'linear-gradient(to bottom right, #ffffff, #fef2f2)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase' }}>
                  Urgent Incidents
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="alert" size={16} color="#dc2626" />
                </div>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#dc2626', marginTop: '6px' }}>
                {stats.highPriorityUnresolved}
              </div>
              <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px' }}>
                High-priority open load
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '24px',
            marginBottom: '28px'
          }}>
            {/* PIE CHART: Categories (Department) Distribution */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Icon name="pie-chart" size={18} color="#2563eb" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Ticket Categories Distribution
                </h3>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 20px 0' }}>
                Breakdown of assigned tickets across AI-classified departments.
              </p>

              <PieChart data={stats.categoryData} size={250} />
            </div>

            {/* Resolution Ratio & Priority Breakdown Card */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Icon name="chart" size={18} color="#7c3aed" />
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    Resolution Progress & Priority Breakdown
                  </h3>
                </div>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 24px 0' }}>
                  Status completion balance and urgency metrics.
                </p>

                {/* Visual Ratio Progress Bar */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ fontWeight: '700', color: '#16a34a' }}>
                      Resolved ({stats.resolved})
                    </span>
                    <span style={{ fontWeight: '700', color: '#ea580c' }}>
                      Unresolved ({stats.unresolved})
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '14px',
                    backgroundColor: '#fed7aa',
                    borderRadius: '7px',
                    overflow: 'hidden',
                    display: 'flex'
                  }}>
                    <div style={{
                      width: `${stats.resolutionRate}%`,
                      backgroundColor: '#22c55e',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Priority Breakdown Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.priorityData.map((p) => {
                    const pct = stats.totalAssigned > 0 ? Math.round((p.value / stats.totalAssigned) * 100) : 0;
                    return (
                      <div key={p.name} style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: p.color
                          }} />
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                            {p.name} Priority
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                            {p.value} tickets
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: '12px',
                color: '#1d4ed8'
              }}>
                <Icon name="shield" size={14} color="#1d4ed8" style={{ marginRight: '6px' }} />
                <span>Auto-routing actively maintains queue balance within assigned capacity limits.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentAnalyticsPage;
