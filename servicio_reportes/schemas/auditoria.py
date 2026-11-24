from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditoriaCreate(BaseModel):
    userId: int = Field(ge=1)
    action: str = Field(min_length=1, max_length=100)


class AuditoriaResponse(BaseModel):
    id: int
    user_id: int
    action: str
    service: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
