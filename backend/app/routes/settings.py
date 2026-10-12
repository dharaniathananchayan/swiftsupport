from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database.dependencies import get_db
from ..models.sla_policy import SLAPolicy
from ..models.user import User
from ..schemas.sla_policy import SLAPolicyResponse, SLAPolicyUpdate
from ..auth.security import require_roles

router = APIRouter(
    prefix="/settings",
    tags=["Admin Settings"]
)

@router.get("/sla", response_model=List[SLAPolicyResponse])
def get_sla_policies(db: Session = Depends(get_db)):
    return db.query(SLAPolicy).all()

@router.put("/sla/{priority}", response_model=SLAPolicyResponse)
def update_sla_policy(
    priority: str,
    policy_update: SLAPolicyUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles(["admin"]))
):
    policy = db.query(SLAPolicy).filter(SLAPolicy.priority == priority).first()
    if not policy:
        raise HTTPException(status_code=404, detail=f"SLA policy for priority '{priority}' not found")
        
    policy.target_hours = policy_update.target_hours
    if policy_update.description:
        policy.description = policy_update.description
        
    db.commit()
    db.refresh(policy)
    return policy

@router.get("/analytics")
def get_admin_analytics(db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    from ..models.ticket import Ticket
    from ..models.user import User
    from ..models.sla_policy import SLAPolicy
    from ..metrics.prometheus_metrics import sync_database_metrics

    sync_database_metrics(db)
    now = datetime.utcnow()
    tickets = db.query(Ticket).all()
    users = db.query(User).all()

    total_tickets = len(tickets)
    resolved_tickets = [t for t in tickets if t.status == "Resolved"]
    open_tickets = [t for t in tickets if t.status == "Open"]
    
    resolved_count = len(resolved_tickets)
    open_count = len(open_tickets)
    resolution_rate = round((resolved_count / total_tickets * 100), 1) if total_tickets > 0 else 0.0

    # SLA breaches
    sla_breached_tickets = [
        t for t in open_tickets
        if t.sla_deadline and t.sla_deadline < now
    ]
    sla_breached_count = len(sla_breached_tickets)
    sla_compliance_rate = round(((total_tickets - sla_breached_count) / total_tickets * 100), 1) if total_tickets > 0 else 100.0

    # Resolution duration (MTTR)
    resolution_durations = [
        (t.resolved_at - t.created_at).total_seconds() / 3600
        for t in resolved_tickets
        if t.resolved_at and t.created_at and t.resolved_at >= t.created_at
    ]
    avg_resolution_hours = round(sum(resolution_durations) / len(resolution_durations), 1) if resolution_durations else 0.0

    # First response / agent reply duration
    reply_durations = [
        (t.agent_reply_at - t.created_at).total_seconds() / 3600
        for t in tickets
        if t.agent_reply_at and t.created_at and t.agent_reply_at >= t.created_at
    ]
    avg_first_response_hours = round(sum(reply_durations) / len(reply_durations), 1) if reply_durations else 0.0

    # AI Automation metrics
    classified_tickets = [t for t in tickets if t.department and t.priority]
    ai_automation_rate = round((len(classified_tickets) / total_tickets * 100), 1) if total_tickets > 0 else 0.0

    auto_assigned_tickets = [t for t in tickets if t.assigned_agent_id is not None]
    auto_assigned_rate = round((len(auto_assigned_tickets) / total_tickets * 100), 1) if total_tickets > 0 else 0.0

    cluster_parents = [t for t in tickets if t.is_cluster_parent]
    active_clusters_count = len(cluster_parents)
    clustered_children_count = sum(len(t.clustered_tickets or []) for t in cluster_parents)

    # Department breakdown
    dept_names = ["Technical", "Billing", "Sales", "Account", "Shipping", "Unclassified"]
    dept_stats = {}
    for d in dept_names:
        d_tickets = [t for t in tickets if (t.department or "Unclassified") == d]
        d_open = [t for t in d_tickets if t.status == "Open"]
        d_resolved = [t for t in d_tickets if t.status == "Resolved"]
        dept_stats[d] = {
            "department": d,
            "total": len(d_tickets),
            "open": len(d_open),
            "resolved": len(d_resolved),
            "percentage": round(len(d_tickets) / total_tickets * 100, 1) if total_tickets > 0 else 0.0
        }

    # Priority breakdown
    priority_names = ["High", "Medium", "Low", "Unclassified"]
    priority_stats = {}
    for p in priority_names:
        p_tickets = [t for t in tickets if (t.priority or "Unclassified") == p]
        p_open = [t for t in p_tickets if t.status == "Open"]
        p_resolved = [t for t in p_tickets if t.status == "Resolved"]
        priority_stats[p] = {
            "priority": p,
            "total": len(p_tickets),
            "open": len(p_open),
            "resolved": len(p_resolved),
            "percentage": round(len(p_tickets) / total_tickets * 100, 1) if total_tickets > 0 else 0.0
        }

    # Sentiment breakdown
    sentiment_names = ["Positive", "Neutral", "Negative", "Unclassified"]
    sentiment_stats = {}
    for s in sentiment_names:
        s_tickets = [t for t in tickets if (t.sentiment or "Unclassified") == s]
        sentiment_stats[s] = {
            "sentiment": s,
            "total": len(s_tickets),
            "percentage": round(len(s_tickets) / total_tickets * 100, 1) if total_tickets > 0 else 0.0
        }

    pos_count = sentiment_stats["Positive"]["total"]
    neg_count = sentiment_stats["Negative"]["total"]
    net_sentiment_score = round(((pos_count - neg_count) / total_tickets * 100), 1) if total_tickets > 0 else 0.0

    # Timeline influx (Last 7 days)
    timeline = []
    for day_offset in range(6, -1, -1):
        target_date = (now - timedelta(days=day_offset)).date()
        date_str = target_date.strftime("%Y-%m-%d")
        display_label = target_date.strftime("%b %d")
        day_created = sum(1 for t in tickets if t.created_at and t.created_at.date() == target_date)
        day_resolved = sum(1 for t in tickets if t.resolved_at and t.resolved_at.date() == target_date)
        timeline.append({
            "date": date_str,
            "label": display_label,
            "created": day_created,
            "resolved": day_resolved
        })

    # Staff / Agent Workload & Performance
    agents = [u for u in users if u.role in ("agent", "admin")]
    agent_stats = []
    for a in agents:
        a_assigned = [t for t in tickets if t.assigned_agent_id == a.id]
        a_open = [t for t in a_assigned if t.status == "Open"]
        a_resolved = [t for t in a_assigned if t.status == "Resolved"]
        max_cap = a.max_concurrent_tickets or 5
        cap_util = round(len(a_open) / max_cap * 100, 1) if max_cap > 0 else 0.0
        agent_stats.append({
            "id": a.id,
            "full_name": a.full_name,
            "email": a.email,
            "department": a.department or "Technical",
            "role": a.role,
            "is_available": a.is_available,
            "max_concurrent_tickets": max_cap,
            "assigned_total": len(a_assigned),
            "active_tickets": len(a_open),
            "resolved_tickets": len(a_resolved),
            "capacity_utilization": cap_util
        })

    # Raw Prometheus Telemetry Map
    prometheus_telemetry = {
        "support_tickets_created_total": total_tickets,
        "support_tickets_resolved_total": resolved_count,
        "support_tickets_by_status": { "Open": open_count, "Resolved": resolved_count },
        "support_tickets_by_priority": { p: priority_stats[p]["total"] for p in priority_names },
        "support_tickets_by_department": { d: dept_stats[d]["total"] for d in dept_names },
        "support_tickets_by_sentiment": { s: sentiment_stats[s]["total"] for s in sentiment_names },
        "support_tickets_sla_breached": sla_breached_count,
        "prometheus_endpoint": "/metrics",
        "scrape_status": "Active & Synchronized"
    }

    return {
        "summary": {
            "total_tickets": total_tickets,
            "open_tickets": open_count,
            "resolved_tickets": resolved_count,
            "resolution_rate": resolution_rate,
            "sla_breached_count": sla_breached_count,
            "sla_compliance_rate": sla_compliance_rate,
            "avg_resolution_hours": avg_resolution_hours,
            "avg_first_response_hours": avg_first_response_hours,
            "ai_automation_rate": ai_automation_rate,
            "auto_assigned_rate": auto_assigned_rate,
            "active_clusters_count": active_clusters_count,
            "clustered_children_count": clustered_children_count,
            "net_sentiment_score": net_sentiment_score
        },
        "department_stats": list(dept_stats.values()),
        "priority_stats": list(priority_stats.values()),
        "sentiment_stats": list(sentiment_stats.values()),
        "timeline": timeline,
        "agent_stats": agent_stats,
        "prometheus_telemetry": prometheus_telemetry,
        "timestamp": now.isoformat()
    }

