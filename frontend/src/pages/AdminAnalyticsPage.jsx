import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAdminAnalytics } from '../services/api';
import Icon from '../components/Icon';

const DEPARTMENT_COLORS = {
  Technical: '#8b5cf6',
  Billing: '#3b82f6',
  Sales: '#10b981',
  Account: '#f59e0b',
  Shipping: '#ec4899',
  Unclassified: '#64748b'
};

const PRIORITY_COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
  Unclassified: '#94a3b8'
};

const SENTIMENT_COLORS = {
  Positive: '#10b981',
  Neutral: '#64748b',
  Negative: '#ef4444',
  Unclassified: '#94a3b8'
};

// SVG Donut Chart with Hover Tooltip
function DonutChart({ data, size = 240, innerRadius = 70 }) {
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const total = useMemo(() => {
    return data.reduce((acc, item) => acc + (item.value || 0), 0);
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
        No categorized data available
      </div>
    );
  }

  const radius = size / 2 - 12;
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

    const ix1 = center + innerRadius * Math.sin(endAngle);
    const iy1 = center - innerRadius * Math.cos(endAngle);
    const ix2 = center + innerRadius * Math.sin(startAngle);
    const iy2 = center - innerRadius * Math.cos(startAngle);

    const largeArcFlag = fraction > 0.5 ? 1 : 0;

    const pathData = fraction >= 0.999
      ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius} M ${center} ${center - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${center - 0.001} ${center - innerRadius} Z`
      : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2} Z`;

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
              strokeWidth="2"
              style={{
                cursor: 'pointer',
                transition: 'transform 0.15s, opacity 0.15s',
                transformOrigin: `${center}px ${center}px`,
                transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                opacity: hoveredSlice && !isHovered ? 0.6 : 1,
              }}
              onMouseEnter={() => setHoveredSlice(slice)}
              onMouseLeave={() => setHoveredSlice(null)}
            />
          );
        })}
      </svg>

      {/* Center Label */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>
          {hoveredSlice ? hoveredSlice.value : total}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
          {hoveredSlice ? hoveredSlice.name : 'Total Items'}
        </div>
      </div>
    </div>
  );
}

// Timeline Multi-Bar Chart (Created vs Resolved)
function TimelineBarChart({ timeline = [] }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  const maxValue = useMemo(() => {
    let max = 1;
    timeline.forEach(item => {
      if (item.created > max) max = item.created;
      if (item.resolved > max) max = item.resolved;
    });
    return Math.max(max, 5);
  }, [timeline]);

  const height = 180;
  const paddingBottom = 28;
  const chartHeight = height - paddingBottom;

  if (timeline.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
        No timeline data recorded yet
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height, gap: '12px', padding: '10px 0 0 0' }}>
        {timeline.map((item, idx) => {
          const createdH = Math.max((item.created / maxValue) * (chartHeight - 10), item.created > 0 ? 6 : 2);
          const resolvedH = Math.max((item.resolved / maxValue) * (chartHeight - 10), item.resolved > 0 ? 6 : 2);
          const isHovered = hoveredDay?.date === item.date;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredDay(item)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: chartHeight + 12,
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontWeight: '700', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ color: '#60a5fa' }}>Created: {item.created}</div>
                  <div style={{ color: '#4ade80' }}>Resolved: {item.resolved}</div>
                </div>
              )}

              {/* Bars Pair */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center' }}>
                <div
                  title={`Created: ${item.created}`}
                  style={{
                    width: '40%',
                    maxWidth: '18px',
                    height: `${createdH}px`,
                    backgroundColor: item.created > 0 ? '#3b82f6' : '#e2e8f0',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s',
                    transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                    transformOrigin: 'bottom'
                  }}
                />
                <div
                  title={`Resolved: ${item.resolved}`}
                  style={{
                    width: '40%',
                    maxWidth: '18px',
                    height: `${resolvedH}px`,
                    backgroundColor: item.resolved > 0 ? '#10b981' : '#e2e8f0',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s',
                    transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                    transformOrigin: 'bottom'
                  }}
                />
              </div>

              {/* X-axis label */}
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                fontWeight: isHovered ? '700' : '500',
                color: isHovered ? '#0f172a' : '#64748b',
                whiteSpace: 'nowrap'
              }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '14px', fontSize: '12px', fontWeight: '600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '3px' }} />
          <span style={{ color: '#334155' }}>Tickets Created (Influx)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '3px' }} />
          <span style={{ color: '#334155' }}>Tickets Resolved (Closed)</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'workload' | 'prometheus'

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getAdminAnalytics();
      setData(res);
      setLastSync(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
      setError('Failed to fetch real-time observability telemetry.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live Auto-Refresh every 5 seconds (simulates live Grafana dashboard poll)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const summary = data?.summary || {
    total_tickets: 0,
    open_tickets: 0,
    resolved_tickets: 0,
    resolution_rate: 0,
    sla_breached_count: 0,
    sla_compliance_rate: 100,
    avg_resolution_hours: 0,
    ai_automation_rate: 0,
    auto_assigned_rate: 0,
    active_clusters_count: 0,
    net_sentiment_score: 0
  };

  const departmentData = useMemo(() => {
    if (!data?.department_stats) return [];
    return data.department_stats
      .filter(item => item.total > 0)
      .map(item => ({
        name: item.department,
        value: item.total,
        color: DEPARTMENT_COLORS[item.department] || '#64748b'
      }));
  }, [data]);

  const priorityData = useMemo(() => {
    if (!data?.priority_stats) return [];
    return data.priority_stats
      .filter(item => item.total > 0)
      .map(item => ({
        name: item.priority,
        value: item.total,
        color: PRIORITY_COLORS[item.priority] || '#94a3b8'
      }));
  }, [data]);

  const sentimentData = useMemo(() => {
    if (!data?.sentiment_stats) return [];
    return data.sentiment_stats
      .filter(item => item.total > 0)
      .map(item => ({
        name: item.sentiment,
        value: item.total,
        color: SENTIMENT_COLORS[item.sentiment] || '#94a3b8'
      }));
  }, [data]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="metrics" size={20} color="#2563eb" />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
                Grafana Metrics & Analytics Dashboard
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                Live operational replacement for Grafana: tracking ticket influx, SLA compliance, department load distribution, sentiment, and Prometheus telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Live Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Live Sync Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#64748b'
          }}>
            <span
              className="pulse-dot"
              style={{
                backgroundColor: autoRefresh ? '#22c55e' : '#94a3b8',
                width: '8px',
                height: '8px',
                borderRadius: '50%'
              }}
            />
            <span>
              {autoRefresh ? 'Live Stream Active' : 'Polling Paused'} ({lastSync.toLocaleTimeString()})
            </span>
          </div>

          {/* Toggle Auto-Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: autoRefresh ? '#eff6ff' : '#ffffff',
              color: autoRefresh ? '#2563eb' : '#475569',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Icon name="activity" size={13} color={autoRefresh ? '#2563eb' : '#475569'} />
            <span>{autoRefresh ? 'Auto-Sync On (5s)' : 'Auto-Sync Off'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
            }}
          >
            <Icon name="refresh" size={13} color="#ffffff" />
            <span>{loading ? 'Refreshing...' : 'Refresh Now'}</span>
          </button>
        </div>
      </div>

      {/* Grafana Replacement Notice Callout */}
      <div style={{
        backgroundColor: '#fff7ed',
        borderRadius: '12px',
        border: '1px solid #fed7aa',
        padding: '12px 18px',
        marginBottom: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="activity" size={16} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#9a3412' }}>
              Built-in Grafana Telemetry Dashboard (Prometheus Synchronized)
            </div>
            <div style={{ fontSize: '12px', color: '#c2410c' }}>
              Grafana daemon is not running on port 3000. All metrics from <code>customer_support_metrics.json</code> are rendered live directly here.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="http://localhost:8000/metrics"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '5px 12px',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid #fed7aa',
              color: '#c2410c',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Icon name="pulse" size={12} color="#c2410c" />
            <span>Raw /metrics Stream ↗</span>
          </a>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '12px',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'overview' ? '1px solid #2563eb' : '1px solid transparent',
            backgroundColor: activeTab === 'overview' ? '#eff6ff' : 'transparent',
            color: activeTab === 'overview' ? '#2563eb' : '#64748b',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Icon name="chart" size={15} color={activeTab === 'overview' ? '#2563eb' : '#64748b'} />
          <span>Executive Overview & Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('workload')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'workload' ? '1px solid #2563eb' : '1px solid transparent',
            backgroundColor: activeTab === 'workload' ? '#eff6ff' : 'transparent',
            color: activeTab === 'workload' ? '#2563eb' : '#64748b',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Icon name="users" size={15} color={activeTab === 'workload' ? '#2563eb' : '#64748b'} />
          <span>Agent Capacity & Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab('prometheus')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: activeTab === 'prometheus' ? '1px solid #2563eb' : '1px solid transparent',
            backgroundColor: activeTab === 'prometheus' ? '#eff6ff' : 'transparent',
            color: activeTab === 'prometheus' ? '#2563eb' : '#64748b',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Icon name="activity" size={15} color={activeTab === 'prometheus' ? '#2563eb' : '#64748b'} />
          <span>Prometheus Telemetry Gauges</span>
        </button>
      </div>

      {/* Top KPI Cards Strip (Grafana Single-Stat Panels) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '16px',
        marginBottom: '26px'
      }}>
        {/* Total Tickets */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Total Influx</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="portal" size={14} color="#2563eb" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>
            {summary.total_tickets}
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="trending-up" size={12} color="#16a34a" />
            <span>{summary.resolution_rate}% Resolved Rate</span>
          </div>
        </div>

        {/* Active Open Queue */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Open Backlog</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={14} color="#ea580c" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: summary.open_tickets > 0 ? '#ea580c' : '#0f172a', marginTop: '8px' }}>
            {summary.open_tickets}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Pending agent assignment/reply
          </div>
        </div>

        {/* SLA Compliance */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>SLA Compliance</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: summary.sla_breached_count > 0 ? '#fef2f2' : '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="shield" size={14} color={summary.sla_breached_count > 0 ? '#dc2626' : '#059669'} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: summary.sla_compliance_rate >= 80 ? '#059669' : '#dc2626', marginTop: '8px' }}>
            {summary.sla_compliance_rate}%
          </div>
          <div style={{ fontSize: '11px', color: summary.sla_breached_count > 0 ? '#dc2626' : '#16a34a', fontWeight: '600', marginTop: '4px' }}>
            {summary.sla_breached_count} ticket{summary.sla_breached_count === 1 ? '' : 's'} past SLA
          </div>
        </div>

        {/* AI Automation */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>AI Triage Rate</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ai" size={14} color="#7c3aed" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#7c3aed', marginTop: '8px' }}>
            {summary.ai_automation_rate}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Auto-assigned: {summary.auto_assigned_rate}%
          </div>
        </div>

        {/* Outage Clusters */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Incident Clusters</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="cluster" size={14} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>
            {summary.active_clusters_count}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {summary.clustered_children_count} duplicates grouped
          </div>
        </div>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW & TRENDS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Main Visuals Row: Influx Timeline & Department Donut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1.3fr)', gap: '20px' }}>
            {/* Timeline Influx Chart */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    Ticket Influx vs Resolution Velocity
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Daily tracking of incoming support inquiries and resolved cases.
                  </p>
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb'
                }}>
                  Last 7 Days
                </div>
              </div>

              <TimelineBarChart timeline={data?.timeline || []} />
            </div>

            {/* Department Load Distribution Donut */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Department Load Distribution
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Proportion of tickets routed across operational teams.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DonutChart data={departmentData} size={220} innerRadius={65} />
              </div>

              {/* Department Table Breakdown */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(data?.department_stats || []).map((dept, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      padding: '4px 6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: DEPARTMENT_COLORS[dept.department] || '#94a3b8'
                      }} />
                      <span style={{ fontWeight: '600', color: '#334155' }}>{dept.department}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#64748b' }}>{dept.open} open</span>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>{dept.total} ({dept.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Visuals Row: Priority Breakdown & Customer Sentiment Pulse */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Priority Severity Breakdown */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Priority Severity Distribution
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Urgency stratification assigned by triage rules.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(data?.priority_stats || []).map((p, idx) => {
                  const color = PRIORITY_COLORS[p.priority] || '#94a3b8';
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                        <span style={{ fontWeight: '700', color: '#1e293b' }}>{p.priority} Priority</span>
                        <span style={{ fontWeight: '600', color: '#64748b' }}>
                          {p.total} tickets ({p.percentage}%) · <strong style={{ color: p.open > 0 ? '#ea580c' : '#10b981' }}>{p.open} open</strong>
                        </span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${p.percentage}%`,
                          backgroundColor: color,
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Customer Sentiment Pulse */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    Customer Sentiment Analysis
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Automated sentiment categorization from customer messages.
                  </p>
                </div>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  backgroundColor: summary.net_sentiment_score >= 0 ? '#ecfdf5' : '#fef2f2',
                  color: summary.net_sentiment_score >= 0 ? '#059669' : '#dc2626',
                  border: `1px solid ${summary.net_sentiment_score >= 0 ? '#a7f3d0' : '#fecaca'}`
                }}>
                  Net Score: {summary.net_sentiment_score > 0 ? `+${summary.net_sentiment_score}` : summary.net_sentiment_score}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DonutChart data={sentimentData} size={200} innerRadius={60} />
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                {(data?.sentiment_stats || []).map((s, idx) => (
                  <div key={idx} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: '700', color: SENTIMENT_COLORS[s.sentiment] || '#64748b' }}>
                      {s.sentiment}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {s.total} ({s.percentage}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AGENT CAPACITY & WORKLOAD LEADERBOARD */}
      {activeTab === 'workload' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Staff Capacity & Workload Allocation
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Real-time monitoring of assigned ticket volume versus maximum concurrent capacity per support specialist.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Agent Name & Role</th>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Department</th>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Status</th>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Assigned</th>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Active Backlog</th>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Resolved</th>
                  <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Capacity Utilization</th>
                </tr>
              </thead>
              <tbody>
                {(data?.agent_stats || []).map((agent) => {
                  const utilColor = agent.capacity_utilization >= 100
                    ? '#ef4444'
                    : agent.capacity_utilization >= 60
                    ? '#f59e0b'
                    : '#10b981';

                  return (
                    <tr key={agent.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{agent.full_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{agent.email} · {agent.role.toUpperCase()}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8'
                        }}>
                          {agent.department}
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: agent.is_available ? '#15803d' : '#94a3b8'
                        }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: agent.is_available ? '#22c55e' : '#cbd5e1'
                          }} />
                          {agent.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: '700', color: '#0f172a' }}>
                        {agent.assigned_total}
                      </td>
                      <td style={{ padding: '14px', fontWeight: '700', color: agent.active_tickets > 0 ? '#ea580c' : '#64748b' }}>
                        {agent.active_tickets}
                      </td>
                      <td style={{ padding: '14px', fontWeight: '700', color: '#059669' }}>
                        {agent.resolved_tickets}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(agent.capacity_utilization, 100)}%`,
                              backgroundColor: utilColor,
                              borderRadius: '4px'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: utilColor, minWidth: '45px' }}>
                            {agent.active_tickets}/{agent.max_concurrent_tickets} ({agent.capacity_utilization}%)
                          </span>
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

      {/* TAB 3: PROMETHEUS TELEMETRY GAUGES EXPLORER */}
      {activeTab === 'prometheus' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div style={{
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="activity" size={18} color="#c2410c" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#9a3412', margin: 0 }}>
                  Prometheus Core Metrics Telemetry Live
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#c2410c', margin: '4px 0 0 0' }}>
                Direct synchronization with backend metrics collector. Replaces Grafana by providing complete visibility into raw gauges.
              </p>
            </div>
            <a
              href="http://localhost:8000/metrics"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '12px',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
              }}
            >
              <Icon name="external" size={13} color="#ffffff" />
              <span>Inspect Raw /metrics Stream</span>
            </a>
          </div>

          {/* Gauges Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Status Gauges */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Gauge: support_tickets_by_status
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(data?.prometheus_telemetry?.support_tickets_by_status || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#334155', fontFamily: 'monospace' }}>status="{key}"</span>
                    <strong style={{ color: '#0f172a' }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Gauges */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Gauge: support_tickets_by_priority
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(data?.prometheus_telemetry?.support_tickets_by_priority || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#334155', fontFamily: 'monospace' }}>priority="{key}"</span>
                    <strong style={{ color: '#0f172a' }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Gauges */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Gauge: support_tickets_by_department
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(data?.prometheus_telemetry?.support_tickets_by_department || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#334155', fontFamily: 'monospace' }}>department="{key}"</span>
                    <strong style={{ color: '#0f172a' }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Breached Gauge */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Gauge: support_tickets_sla_breached
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: (data?.prometheus_telemetry?.support_tickets_sla_breached || 0) > 0 ? '#dc2626' : '#10b981', marginTop: '4px' }}>
                {data?.prometheus_telemetry?.support_tickets_sla_breached || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Open tickets exceeding SLA policy resolution deadline
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
