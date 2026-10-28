"""api/toolkit.py — DBA script library endpoints."""
from __future__ import annotations

from typing import List, Optional, Union
from fastapi import APIRouter, Query

from app.schemas.toolkit import DBAScript
from app.services.toolkit_service import get_all_scripts, get_categories

router = APIRouter(tags=["DBA Toolkit"])


@router.get("/toolkit/scripts", response_model=List[DBAScript])
def read_toolkit_scripts(
    search: Optional[str] = Query(None, description="Search term in name, description, tags, or sql"),
    category: Optional[str] = Query(None, description="Category filter"),
):
    """Retrieve categorized, searchable T-SQL scripts with safety risk levels."""
    return get_all_scripts(search=search or "", category=category or "")


@router.get("/toolkit/categories", response_model=List[str])
def read_toolkit_categories():
    """Retrieve list of distinct DBA script categories."""
    cats = get_categories()
    return [c.name for c in cats]
