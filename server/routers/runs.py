"""Run history and file download endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..services import execution_service

router = APIRouter()


@router.get("")
def list_runs(
    definition_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
):
    return execution_service.list_runs(definition_id, page, page_size, status)


@router.get("/{run_id}")
def get_run(run_id: str):
    result = execution_service.get_run(run_id)
    if not result:
        raise HTTPException(status_code=404, detail="Run not found")
    return result


@router.get("/{run_id}/download")
def download_run_file(run_id: str):
    try:
        file_bytes, filename, content_type = execution_service.download_run_file(run_id)
        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
