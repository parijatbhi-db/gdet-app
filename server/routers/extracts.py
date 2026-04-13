"""Extract definitions API endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException

from ..models.schemas import ExtractDefinitionCreate, ExtractDefinitionUpdate, RunTriggerRequest
from ..services import extract_service, execution_service
from ..db import get_sql_executor
from ..config import CATALOG, SCHEMA

router = APIRouter()


@router.get("")
def list_extracts(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    extract_type: Optional[str] = None,
    status: Optional[str] = None,
):
    return extract_service.list_definitions(page, page_size, search, extract_type, status)


@router.get("/dashboard/metrics")
def get_dashboard_metrics():
    db = get_sql_executor()
    total_defs = db.execute_scalar(
        f"SELECT COUNT(*) FROM {CATALOG}.{SCHEMA}.extract_definitions WHERE status != 'inactive'"
    )
    total_runs = db.execute_scalar(
        f"SELECT COUNT(*) FROM {CATALOG}.{SCHEMA}.extract_runs"
    )
    success_rate = db.execute_scalar(
        f"SELECT ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / "
        f"NULLIF(COUNT(*), 0), 1) FROM {CATALOG}.{SCHEMA}.extract_runs"
    )
    active_schedules = db.execute_scalar(
        f"SELECT COUNT(*) FROM {CATALOG}.{SCHEMA}.extract_schedules WHERE is_active = true"
    )
    recent_runs = db.execute_as_dicts(
        f"SELECT r.id, r.status, r.started_at, r.completed_at, r.row_count, r.file_size_bytes, "
        f"d.name as extract_name, d.extract_type "
        f"FROM {CATALOG}.{SCHEMA}.extract_runs r "
        f"LEFT JOIN {CATALOG}.{SCHEMA}.extract_definitions d ON r.extract_definition_id = d.id "
        f"ORDER BY r.started_at DESC LIMIT 10"
    )
    type_counts = db.execute_as_dicts(
        f"SELECT extract_type, COUNT(*) as count FROM {CATALOG}.{SCHEMA}.extract_definitions "
        f"WHERE status != 'inactive' GROUP BY extract_type"
    )
    return {
        "total_definitions": int(total_defs or 0),
        "total_runs": int(total_runs or 0),
        "success_rate_pct": float(success_rate or 0),
        "active_schedules": int(active_schedules or 0),
        "recent_runs": recent_runs,
        "type_counts": type_counts,
    }


@router.get("/source-columns/{source_table:path}")
def get_source_columns(source_table: str):
    try:
        return extract_service.get_source_columns(source_table)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{definition_id}")
def get_extract(definition_id: str):
    result = extract_service.get_definition(definition_id)
    if not result:
        raise HTTPException(status_code=404, detail="Extract definition not found")
    return result


@router.post("")
def create_extract(data: ExtractDefinitionCreate):
    return extract_service.create_definition(data.model_dump(exclude_none=True), "demo_user")


@router.put("/{definition_id}")
def update_extract(definition_id: str, data: ExtractDefinitionUpdate):
    result = extract_service.update_definition(
        definition_id, data.model_dump(exclude_none=True), "demo_user"
    )
    if not result:
        raise HTTPException(status_code=404, detail="Extract definition not found")
    return result


@router.delete("/{definition_id}")
def delete_extract(definition_id: str):
    extract_service.delete_definition(definition_id, "demo_user")
    return {"status": "deleted"}


@router.post("/{definition_id}/preview")
def preview_extract(definition_id: str, body: RunTriggerRequest = None):
    definition = extract_service.get_definition(definition_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Extract definition not found")
    overrides = body.parameter_overrides if body else None
    query = extract_service.build_extract_query(definition, overrides, limit=100)
    db = get_sql_executor()
    columns, rows = db.execute(query)
    return {"columns": columns, "rows": rows, "query": query, "row_count": len(rows)}


@router.post("/{definition_id}/run")
def run_extract(definition_id: str, body: RunTriggerRequest = None):
    definition = extract_service.get_definition(definition_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Extract definition not found")
    overrides = body.parameter_overrides if body else None
    return execution_service.execute_extract(definition_id, overrides, "user", "demo_user")
