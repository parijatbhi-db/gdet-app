"""Extract definition CRUD and query building."""
import json
import uuid
from datetime import datetime
from typing import Optional

from ..config import CATALOG, SCHEMA
from ..db import get_sql_executor

TABLE = f"{CATALOG}.{SCHEMA}.extract_definitions"
AUDIT_TABLE = f"{CATALOG}.{SCHEMA}.audit_log"

SOURCE_TABLE_MAP = {
    "inventory": f"{CATALOG}.{SCHEMA}.inventory_data",
    "pos": f"{CATALOG}.{SCHEMA}.pos_data",
    "price_feed": f"{CATALOG}.{SCHEMA}.price_feed_data",
    "scip_reach": f"{CATALOG}.{SCHEMA}.scip_reach_data",
}


def _escape(val: str) -> str:
    """Escape single quotes for SQL string literals."""
    if val is None:
        return ""
    return str(val).replace("'", "''")


def list_definitions(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    extract_type: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    db = get_sql_executor()
    where_clauses = ["status != 'inactive'"]
    if search:
        where_clauses.append(f"lower(name) LIKE '%{_escape(search.lower())}%'")
    if extract_type:
        where_clauses.append(f"extract_type = '{_escape(extract_type)}'")
    if status:
        where_clauses.append(f"status = '{_escape(status)}'")

    where = " AND ".join(where_clauses)
    offset = (page - 1) * page_size

    total = db.execute_scalar(f"SELECT COUNT(*) FROM {TABLE} WHERE {where}")
    rows = db.execute_as_dicts(
        f"SELECT * FROM {TABLE} WHERE {where} ORDER BY updated_at DESC LIMIT {page_size} OFFSET {offset}"
    )
    # Parse JSON fields
    for row in rows:
        row["columns_config"] = _parse_json(row.get("columns_config"))
        row["parameters"] = _parse_json(row.get("parameters"))
        row["tags"] = _parse_json(row.get("tags"))
    return {"data": rows, "total": int(total or 0), "page": page, "page_size": page_size}


def get_definition(definition_id: str) -> Optional[dict]:
    db = get_sql_executor()
    rows = db.execute_as_dicts(
        f"SELECT * FROM {TABLE} WHERE id = '{_escape(definition_id)}'"
    )
    if not rows:
        return None
    row = rows[0]
    row["columns_config"] = _parse_json(row.get("columns_config"))
    row["parameters"] = _parse_json(row.get("parameters"))
    row["tags"] = _parse_json(row.get("tags"))
    return row


def create_definition(data: dict, user: str = "system") -> dict:
    db = get_sql_executor()
    def_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    source_table = data.get("source_table") or SOURCE_TABLE_MAP.get(data["extract_type"], "")
    columns_json = json.dumps(data.get("columns_config", []))
    params_json = json.dumps(data.get("parameters", {}))
    tags_json = json.dumps(data.get("tags", []))

    stmt = f"""INSERT INTO {TABLE} VALUES (
        '{def_id}', '{_escape(data["name"])}', '{_escape(data.get("description", ""))}',
        '{_escape(data["extract_type"])}', '{_escape(source_table)}', NULL,
        '{_escape(columns_json)}', '{_escape(params_json)}',
        '{_escape(data.get("file_format", "csv"))}', '{_escape(data.get("delimiter", ","))}',
        '{_escape(data.get("encoding", "utf-8"))}', '{_escape(data.get("decimal_format", "."))}',
        '{_escape(data.get("file_naming_template", "{name}_{date}"))}',
        {str(data.get("zip_enabled", False)).lower()}, {str(data.get("password_protected", False)).lower()},
        '{_escape(user)}', '{now}', '{now}', 'draft',
        '{_escape(data.get("country_code", ""))}', '{_escape(tags_json)}',
        '{_escape(data.get("sensitivity_level", "internal"))}'
    )"""
    db.execute(stmt)

    # Audit log
    _audit("create", "definition", def_id, user, {"name": data["name"]})
    return get_definition(def_id)


def update_definition(definition_id: str, data: dict, user: str = "system") -> Optional[dict]:
    db = get_sql_executor()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    sets = [f"updated_at = '{now}'"]
    for key, val in data.items():
        if val is None:
            continue
        if key == "columns_config":
            sets.append(f"columns_config = '{_escape(json.dumps(val))}'")
        elif key == "parameters":
            sets.append(f"parameters = '{_escape(json.dumps(val))}'")
        elif key == "tags":
            sets.append(f"tags = '{_escape(json.dumps(val))}'")
        elif key in ("zip_enabled", "password_protected"):
            sets.append(f"{key} = {str(val).lower()}")
        else:
            sets.append(f"{key} = '{_escape(str(val))}'")

    set_clause = ", ".join(sets)
    db.execute(f"UPDATE {TABLE} SET {set_clause} WHERE id = '{_escape(definition_id)}'")

    _audit("update", "definition", definition_id, user, {"fields": list(data.keys())})
    return get_definition(definition_id)


def delete_definition(definition_id: str, user: str = "system") -> bool:
    db = get_sql_executor()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        f"UPDATE {TABLE} SET status = 'inactive', updated_at = '{now}' WHERE id = '{_escape(definition_id)}'"
    )
    _audit("delete", "definition", definition_id, user, {})
    return True


def get_source_columns(source_table: str) -> list[dict]:
    db = get_sql_executor()
    cols, rows = db.execute(f"DESCRIBE TABLE {source_table}")
    result = []
    for row in rows:
        col_name = row[0] if row[0] else ""
        col_type = row[1] if len(row) > 1 else ""
        if col_name and not col_name.startswith("#"):
            result.append({"name": col_name, "type": col_type})
    return result


def build_extract_query(
    definition: dict, param_overrides: Optional[dict] = None, limit: Optional[int] = None
) -> str:
    """Build a SQL SELECT from an extract definition."""
    columns_config = definition.get("columns_config") or []
    if isinstance(columns_config, str):
        columns_config = json.loads(columns_config)

    # Build SELECT clause
    visible_cols = sorted(
        [c for c in columns_config if c.get("visible", True)],
        key=lambda c: c.get("order", 0),
    )
    if visible_cols:
        select_parts = []
        for c in visible_cols:
            col_expr = c["name"]
            if c.get("alias") and c["alias"] != c["name"]:
                col_expr = f"{c['name']} AS `{c['alias']}`"
            select_parts.append(col_expr)
        select_clause = ", ".join(select_parts)
    else:
        select_clause = "*"

    source_table = definition.get("source_table", "")

    # Build WHERE clause from parameters
    params = definition.get("parameters") or {}
    if isinstance(params, str):
        params = json.loads(params)
    if param_overrides:
        params.update(param_overrides)

    where_parts = []
    for key, val in params.items():
        if val is not None and val != "":
            where_parts.append(f"{key} = '{_escape(str(val))}'")

    where_clause = " AND ".join(where_parts) if where_parts else "1=1"
    limit_clause = f" LIMIT {limit}" if limit else ""

    return f"SELECT {select_clause} FROM {source_table} WHERE {where_clause}{limit_clause}"


def _parse_json(val):
    if val is None or val == "":
        return None
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return val


def _audit(action: str, entity_type: str, entity_id: str, user: str, details: dict):
    db = get_sql_executor()
    audit_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    details_json = _escape(json.dumps(details))
    db.execute(
        f"INSERT INTO {AUDIT_TABLE} VALUES ('{audit_id}', '{action}', '{entity_type}', "
        f"'{_escape(entity_id)}', '{_escape(user)}', '{now}', '{details_json}')"
    )
