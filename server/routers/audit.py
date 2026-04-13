"""Audit log endpoint."""
from typing import Optional
from fastapi import APIRouter

from ..db import get_sql_executor
from ..config import CATALOG, SCHEMA
from ..services.extract_service import _escape

router = APIRouter()
TABLE = f"{CATALOG}.{SCHEMA}.audit_log"


@router.get("")
def list_audit_entries(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    db = get_sql_executor()
    where_parts = ["1=1"]
    if entity_type:
        where_parts.append(f"entity_type = '{_escape(entity_type)}'")
    if action:
        where_parts.append(f"action = '{_escape(action)}'")
    where = " AND ".join(where_parts)
    offset = (page - 1) * page_size

    total = db.execute_scalar(f"SELECT COUNT(*) FROM {TABLE} WHERE {where}")
    rows = db.execute_as_dicts(
        f"SELECT * FROM {TABLE} WHERE {where} ORDER BY timestamp DESC "
        f"LIMIT {page_size} OFFSET {offset}"
    )
    return {"data": rows, "total": int(total or 0), "page": page, "page_size": page_size}
