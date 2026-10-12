from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.ticket import Ticket

# --- Prometheus Metrics Definitions ---

# Ticket Influx & Lifecycle
TICKETS_CREATED_TOTAL = Counter(
    "support_tickets_created_total",
    "Total number of support tickets created",
)

TICKETS_RESOLVED_TOTAL = Counter(
    "support_tickets_resolved_total",
    "Total number of support tickets marked as resolved",
)

# Active Status & Breakdowns (Gauges)
TICKETS_BY_STATUS = Gauge(
    "support_tickets_by_status",
    "Count of support tickets by status",
    ["status"]
)

TICKETS_BY_PRIORITY = Gauge(
    "support_tickets_by_priority",
    "Count of support tickets by priority",
    ["priority"]
)

TICKETS_BY_DEPARTMENT = Gauge(
    "support_tickets_by_department",
    "Count of support tickets by department",
    ["department"]
)

TICKETS_BY_SENTIMENT = Gauge(
    "support_tickets_by_sentiment",
    "Count of support tickets by sentiment",
    ["sentiment"]
)

SLA_BREACHED_GAUGE = Gauge(
    "support_tickets_sla_breached",
    "Number of open tickets that have exceeded their SLA deadline",
)

# AI Model Latency
AI_CLASSIFICATION_DURATION = Histogram(
    "support_ai_classification_duration_seconds",
    "Time spent waiting for AI classification in seconds",
    buckets=[0.5, 1.0, 2.5, 5.0, 7.5, 10.0, 15.0, 30.0, 60.0]
)

# HTTP Request Metrics
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests received",
    ["method", "endpoint", "status"]
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"]
)

def sync_database_metrics(db: Session):
    """
    Queries current ticket table state and sets gauges to exact real-time values.
    """
    tickets = db.query(Ticket).all()
    now = datetime.utcnow()

    # Reset status counts
    status_counts = {"Open": 0, "Resolved": 0}
    priority_counts = {"High": 0, "Medium": 0, "Low": 0, "Unclassified": 0}
    dept_counts = {"Billing": 0, "Technical": 0, "Sales": 0, "Account": 0, "Shipping": 0, "Unclassified": 0}
    sentiment_counts = {"Positive": 0, "Neutral": 0, "Negative": 0, "Unclassified": 0}
    sla_breaches = 0

    for t in tickets:
        # Status
        status_key = t.status if t.status in status_counts else "Open"
        status_counts[status_key] += 1

        # Priority
        p_key = t.priority if t.priority in priority_counts else "Unclassified"
        priority_counts[p_key] += 1

        # Department
        d_key = t.department if t.department in dept_counts else "Unclassified"
        dept_counts[d_key] += 1

        # Sentiment
        s_key = t.sentiment if t.sentiment in sentiment_counts else "Unclassified"
        sentiment_counts[s_key] += 1

        # SLA breach check
        if t.status == "Open" and t.sla_deadline and t.sla_deadline < now:
            sla_breaches += 1

    # Update Prometheus gauges
    for status, count in status_counts.items():
        TICKETS_BY_STATUS.labels(status=status).set(count)

    for priority, count in priority_counts.items():
        TICKETS_BY_PRIORITY.labels(priority=priority).set(count)

    for dept, count in dept_counts.items():
        TICKETS_BY_DEPARTMENT.labels(department=dept).set(count)

    for sentiment, count in sentiment_counts.items():
        TICKETS_BY_SENTIMENT.labels(sentiment=sentiment).set(count)

    SLA_BREACHED_GAUGE.set(sla_breaches)
