"""SQL Warehouse query executor using Databricks Statement Execution API."""
import logging
from typing import Any, Optional
from databricks.sdk import WorkspaceClient
from .config import get_workspace_client, WAREHOUSE_ID

logger = logging.getLogger(__name__)


class SqlExecutor:
    """Execute SQL against a Databricks SQL Warehouse."""

    def __init__(self):
        self._w: Optional[WorkspaceClient] = None

    @property
    def w(self) -> WorkspaceClient:
        if self._w is None:
            self._w = get_workspace_client()
        return self._w

    def execute(
        self,
        statement: str,
        parameters: list[dict] | None = None,
        wait_timeout: str = "50s",
    ) -> tuple[list[str], list[list[Any]]]:
        """Execute SQL and return (column_names, rows)."""
        kwargs: dict[str, Any] = {
            "warehouse_id": WAREHOUSE_ID,
            "statement": statement,
            "wait_timeout": wait_timeout,
        }
        if parameters:
            kwargs["parameters"] = parameters

        result = self.w.statement_execution.execute_statement(**kwargs)

        columns: list[str] = []
        if result.manifest and result.manifest.schema and result.manifest.schema.columns:
            columns = [col.name for col in result.manifest.schema.columns]

        data: list[list[Any]] = []
        if result.result and result.result.data_array:
            data = result.result.data_array

        return columns, data

    def execute_as_dicts(
        self, statement: str, parameters: list[dict] | None = None
    ) -> list[dict]:
        """Execute SQL and return list of dicts."""
        columns, rows = self.execute(statement, parameters)
        return [dict(zip(columns, row)) for row in rows]

    def execute_scalar(
        self, statement: str, parameters: list[dict] | None = None
    ) -> Any:
        """Execute SQL that returns a single value."""
        _, rows = self.execute(statement, parameters)
        return rows[0][0] if rows and rows[0] else None


_executor: Optional[SqlExecutor] = None


def get_sql_executor() -> SqlExecutor:
    global _executor
    if _executor is None:
        _executor = SqlExecutor()
    return _executor
