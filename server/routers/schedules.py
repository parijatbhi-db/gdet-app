"""Schedule management endpoints."""
import json
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException

from ..models.schemas import ScheduleCreate, ScheduleUpdate
from ..db import get_sql_executor
from ..config import CATALOG, SCHEMA
from ..services.extract_service import _escape, _audit

router = APIRouter()
TABLE = f"{CATALOG}.{SCHEMA}.extract_schedules"


@router.get("")
def list_schedules(extract_definition_id: Optional[str] = None):
    db = get_sql_executor()
    where = "1=1"
    if extract_definition_id:
        where = f"s.extract_definition_id = '{_escape(extract_definition_id)}'"
    return db.execute_as_dicts(
        f"SELECT s.*, d.name as extract_name, d.extract_type "
        f"FROM {TABLE} s "
        f"LEFT JOIN {CATALOG}.{SCHEMA}.extract_definitions d ON s.extract_definition_id = d.id "
        f"WHERE {where} ORDER BY s.created_at DESC"
    )


@router.post("")
def create_schedule(data: ScheduleCreate):
    db = get_sql_executor()
    sched_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        f"INSERT INTO {TABLE} VALUES ('{sched_id}', '{_escape(data.extract_definition_id)}', "
        f"'{_escape(data.frequency)}', '{_escape(data.cron_expression or '')}', NULL, "
        f"{str(data.is_active).lower()}, NULL, '{now}', '{now}')"
    )
    _audit("create", "schedule", sched_id, "demo_user", {"definition_id": data.extract_definition_id})
    rows = db.execute_as_dicts(f"SELECT * FROM {TABLE} WHERE id = '{sched_id}'")
    return rows[0] if rows else {"id": sched_id}


@router.put("/{schedule_id}")
def update_schedule(schedule_id: str, data: ScheduleUpdate):
    db = get_sql_executor()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    sets = [f"updated_at = '{now}'"]
    d = data.model_dump(exclude_none=True)
    for key, val in d.items():
        if key == "is_active":
            sets.append(f"is_active = {str(val).lower()}")
        else:
            sets.append(f"{key} = '{_escape(str(val))}'")
    db.execute(f"UPDATE {TABLE} SET {', '.join(sets)} WHERE id = '{_escape(schedule_id)}'")
    rows = db.execute_as_dicts(f"SELECT * FROM {TABLE} WHERE id = '{_escape(schedule_id)}'")
    return rows[0] if rows else {"id": schedule_id}


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: str):
    db = get_sql_executor()
    db.execute(f"DELETE FROM {TABLE} WHERE id = '{_escape(schedule_id)}'")
    _audit("delete", "schedule", schedule_id, "demo_user", {})
    return {"status": "deleted"}
