import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from .database.database import engine, Base, SessionLocal
from .routes import tickets, auth, settings
from .auth.security import seed_default_users
from .services.sla_service import seed_default_sla_policies
from .ai.classifier import get_ai_base_url, get_installed_models, resolve_model_name
from .metrics import (
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION_SECONDS,
    sync_database_metrics,
)

def run_migrations():
    """Ensure SQLite columns for duplicate/outage clustering exist on startup."""
    with engine.connect() as conn:
        if engine.dialect.name == "sqlite":
            result = conn.execute(text("PRAGMA table_info(tickets);")).fetchall()
            existing_cols = {row[1] for row in result}
            if existing_cols:
                if "parent_ticket_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN parent_ticket_id INTEGER REFERENCES tickets(id);"))
                if "is_cluster_parent" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN is_cluster_parent BOOLEAN DEFAULT 0;"))
                if "cluster_tag" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN cluster_tag VARCHAR;"))
                if "cluster_reason" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN cluster_reason TEXT;"))
                if "agent_reply" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN agent_reply TEXT;"))
                if "agent_reply_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN agent_reply_at DATETIME;"))
                if "assigned_agent_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN assigned_agent_id INTEGER REFERENCES users(id);"))
                if "screenshot_url" not in existing_cols:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN screenshot_url TEXT;"))

            # Users table columns
            user_cols_res = conn.execute(text("PRAGMA table_info(users);")).fetchall()
            user_cols = {row[1] for row in user_cols_res}
            if user_cols:
                if "department" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR DEFAULT 'Technical';"))
                if "is_available" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_available INTEGER DEFAULT 1;"))
                if "max_concurrent_tickets" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN max_concurrent_tickets INTEGER DEFAULT 5;"))
            conn.commit()

# Run migrations and create any newly added tables (users, sla_policies)
run_migrations()
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SwiftSupport API",
    version="1.0.0"
)

# Enable CORS so the React frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    endpoint = request.url.path
    # Group parameterized routes to prevent high cardinality
    if endpoint.startswith("/tickets/") and endpoint != "/tickets/":
        endpoint = "/tickets/{id}"
        
    HTTP_REQUESTS_TOTAL.labels(
        method=request.method,
        endpoint=endpoint,
        status=str(response.status_code)
    ).inc()
    
    HTTP_REQUEST_DURATION_SECONDS.labels(
        method=request.method,
        endpoint=endpoint
    ).observe(duration)
    
    return response

app.include_router(tickets.router)
app.include_router(auth.router)
app.include_router(settings.router)

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_default_users(db)
        seed_default_sla_policies(db)
        
        # Ensure all existing open tickets are automatically assigned
        from .models.ticket import Ticket
        from .services.ticket_service import auto_assign_ticket
        unassigned_tickets = db.query(Ticket).filter(Ticket.assigned_agent_id == None).all()
        for t in unassigned_tickets:
            try:
                auto_assign_ticket(db, t.id)
            except Exception:
                pass

        sync_database_metrics(db)
    finally:
        db.close()

@app.get("/")
def home():
    return {
        "message": "AI Customer Support Dashboard API is running"
    }

@app.get("/metrics")
def metrics():
    """
    Exposes Prometheus metrics for Prometheus server scraping.
    """
    db = SessionLocal()
    try:
        sync_database_metrics(db)
    finally:
        db.close()
        
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        if engine.dialect.name == "sqlite":
            result = connection.execute(text("SELECT sqlite_version();"))
        else:
            result = connection.execute(text("SELECT version();"))
        version = result.scalar()

    return {
        "status": "connected",
        "database": f"{engine.dialect.name} {version}"
    }

@app.get("/health/ai")
def ai_health():
    base_url = get_ai_base_url()
    models = get_installed_models()
    if not models:
        return {
            "status": "disconnected",
            "ai_url": base_url,
            "error": "AI service not reachable or no models found"
        }
    
    active_model = resolve_model_name()
    return {
        "status": "connected",
        "ai_url": base_url,
        "active_model": active_model,
        "available_models": models
    }