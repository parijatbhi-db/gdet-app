"""Dual-mode authentication for local dev and Databricks Apps runtime."""
import os
import logging
from databricks.sdk import WorkspaceClient

logger = logging.getLogger(__name__)

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))
CATALOG = os.environ.get("CATALOG", "parijat_demos")
SCHEMA = os.environ.get("SCHEMA", "gdet")
WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "")


def get_workspace_client() -> WorkspaceClient:
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    else:
        profile = os.environ.get("DATABRICKS_PROFILE", "e2-demo-west")
        return WorkspaceClient(profile=profile)
