"""Extract execution engine -- runs queries, generates files, writes to UC Volumes."""
import json
import uuid
from datetime import datetime
from typing import Optional

from ..config import CATALOG, SCHEMA, get_workspace_client
from ..db import get_sql_executor
from .extract_service import get_definition, build_extract_query, _escape, _audit
from .file_service import generate_file

RUNS_TABLE = f"{CATALOG}.{SCHEMA}.extract_runs"
VOLUME_BASE = f"/Volumes/{CATALOG}/{SCHEMA}/extract_output"


def execute_extract(
    definition_id: str,
    parameter_overrides: Optional[dict] = None,
    triggered_by: str = "user",
    user: str = "system",
) -> dict:
    """Full extract execution pipeline."""
    db = get_sql_executor()
    run_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    params_json = _escape(json.dumps(parameter_overrides or {}))

    # 1. Create run record
    db.execute(
        f"INSERT INTO {RUNS_TABLE} VALUES ('{run_id}', '{_escape(definition_id)}', NULL, "
        f"'{now}', NULL, 'running', NULL, NULL, NULL, '{params_json}', NULL, "
        f"'{triggered_by}', '{_escape(user)}', 'volume', NULL, 'pending')"
    )

    try:
        # 2. Load definition
        definition = get_definition(definition_id)
        if not definition:
            _update_run_failed(db, run_id, "Extract definition not found")
            return get_run(run_id)

        # 3. Build query
        query = build_extract_query(definition, parameter_overrides)

        # 4. Execute query
        columns, rows = db.execute(query)

        # 5. Generate file
        file_config = {
            "file_format": definition.get("file_format", "csv"),
            "delimiter": definition.get("delimiter", ","),
            "encoding": definition.get("encoding", "utf-8"),
            "decimal_format": definition.get("decimal_format", "."),
            "file_naming_template": definition.get("file_naming_template", "{name}_{date}"),
            "zip_enabled": definition.get("zip_enabled", False),
        }
        # Use aliases from columns_config if available
        col_config = definition.get("columns_config") or []
        if isinstance(col_config, str):
            col_config = json.loads(col_config)
        alias_map = {c["name"]: c.get("alias", c["name"]) for c in col_config if c.get("visible", True)}
        display_columns = [alias_map.get(c, c) for c in columns]

        file_bytes, filename = generate_file(display_columns, rows, file_config, definition)

        # 6. Write to UC Volume
        output_dir = f"{VOLUME_BASE}/{definition.get('name', 'unknown').replace(' ', '_')}"
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        output_path = f"{output_dir}/{date_str}/{filename}"

        w = get_workspace_client()
        w.files.upload(output_path, file_bytes, overwrite=True)

        file_size = len(file_bytes)
        completed = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        # 7. Update run record
        db.execute(
            f"UPDATE {RUNS_TABLE} SET status = 'success', completed_at = '{completed}', "
            f"row_count = {len(rows)}, file_size_bytes = {file_size}, "
            f"output_path = '{_escape(output_path)}', delivery_status = 'delivered' "
            f"WHERE id = '{run_id}'"
        )

        # 8. Audit
        _audit("run", "definition", definition_id, user, {
            "run_id": run_id, "row_count": len(rows), "file_size": file_size, "status": "success"
        })

    except Exception as e:
        _update_run_failed(db, run_id, str(e)[:500])

    return get_run(run_id)


def get_run(run_id: str) -> Optional[dict]:
    db = get_sql_executor()
    rows = db.execute_as_dicts(
        f"SELECT r.*, d.name as extract_name, d.extract_type "
        f"FROM {RUNS_TABLE} r "
        f"LEFT JOIN {CATALOG}.{SCHEMA}.extract_definitions d ON r.extract_definition_id = d.id "
        f"WHERE r.id = '{_escape(run_id)}'"
    )
    return rows[0] if rows else None


def list_runs(
    definition_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
) -> dict:
    db = get_sql_executor()
    where_parts = ["1=1"]
    if definition_id:
        where_parts.append(f"r.extract_definition_id = '{_escape(definition_id)}'")
    if status:
        where_parts.append(f"r.status = '{_escape(status)}'")
    where = " AND ".join(where_parts)
    offset = (page - 1) * page_size

    total = db.execute_scalar(
        f"SELECT COUNT(*) FROM {RUNS_TABLE} r WHERE {where}"
    )
    rows = db.execute_as_dicts(
        f"SELECT r.*, d.name as extract_name, d.extract_type "
        f"FROM {RUNS_TABLE} r "
        f"LEFT JOIN {CATALOG}.{SCHEMA}.extract_definitions d ON r.extract_definition_id = d.id "
        f"WHERE {where} ORDER BY r.started_at DESC LIMIT {page_size} OFFSET {offset}"
    )
    return {"data": rows, "total": int(total or 0), "page": page, "page_size": page_size}


def download_run_file(run_id: str) -> tuple[bytes, str, str]:
    """Download the output file for a run. Returns (bytes, filename, content_type)."""
    run = get_run(run_id)
    if not run or not run.get("output_path"):
        raise FileNotFoundError(f"No output file for run {run_id}")

    w = get_workspace_client()
    resp = w.files.download(run["output_path"])
    file_bytes = resp.contents.read()
    filename = run["output_path"].split("/")[-1]

    content_types = {
        ".csv": "text/csv",
        ".json": "application/json",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
    content_type = content_types.get(ext, "application/octet-stream")

    return file_bytes, filename, content_type


def _update_run_failed(db, run_id: str, error_msg: str):
    completed = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        f"UPDATE {RUNS_TABLE} SET status = 'failed', completed_at = '{completed}', "
        f"error_message = '{_escape(error_msg)}' WHERE id = '{run_id}'"
    )
