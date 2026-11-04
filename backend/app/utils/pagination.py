import math
from collections.abc import Sequence
from typing import Any, TypeVar

from app.schemas.common import PaginatedResponse

T = TypeVar("T")


def paginate_list(
    items: Sequence[Any], total: int, page: int = 1, limit: int = 20
) -> PaginatedResponse[Any]:
    total_pages = math.ceil(total / limit) if limit > 0 else 1
    return PaginatedResponse(
        items=list(items), total=total, page=page, limit=limit, total_pages=total_pages
    )
