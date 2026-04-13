"""Pydantic models for GDET API request and response payloads."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class ColumnConfig(BaseModel):
    name: str
    alias: Optional[str] = None
    order: int = 0
    visible: bool = True


class ExtractDefinitionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    extract_type: str  # inventory|pos|price_feed|scip_reach
    source_table: Optional[str] = None
    columns_config: Optional[list[ColumnConfig]] = None
    parameters: Optional[dict] = None
    file_format: str = "csv"
    delimiter: str = ","
    encoding: str = "utf-8"
    decimal_format: str = "."
    file_naming_template: str = "{name}_{date}"
    zip_enabled: bool = False
    password_protected: bool = False
    country_code: Optional[str] = None
    tags: Optional[list[str]] = None
    sensitivity_level: str = "internal"


class ExtractDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    extract_type: Optional[str] = None
    source_table: Optional[str] = None
    columns_config: Optional[list[ColumnConfig]] = None
    parameters: Optional[dict] = None
    file_format: Optional[str] = None
    delimiter: Optional[str] = None
    encoding: Optional[str] = None
    decimal_format: Optional[str] = None
    file_naming_template: Optional[str] = None
    zip_enabled: Optional[bool] = None
    password_protected: Optional[bool] = None
    status: Optional[str] = None
    country_code: Optional[str] = None
    tags: Optional[list[str]] = None
    sensitivity_level: Optional[str] = None


class RunTriggerRequest(BaseModel):
    parameter_overrides: Optional[dict] = None


class ScheduleCreate(BaseModel):
    extract_definition_id: str
    frequency: str  # daily|weekly|monthly|adhoc
    cron_expression: Optional[str] = None
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    frequency: Optional[str] = None
    cron_expression: Optional[str] = None
    is_active: Optional[bool] = None
