from fastapi import APIRouter
from .extracts import router as extracts_router
from .runs import router as runs_router
from .schedules import router as schedules_router
from .audit import router as audit_router

router = APIRouter()
router.include_router(extracts_router, prefix="/extracts", tags=["extracts"])
router.include_router(runs_router, prefix="/runs", tags=["runs"])
router.include_router(schedules_router, prefix="/schedules", tags=["schedules"])
router.include_router(audit_router, prefix="/audit", tags=["audit"])
