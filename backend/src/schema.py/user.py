import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

from src.models.user import RoleEnum


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.participant
    college: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # lets this read directly from the SQLAlchemy object

    id: uuid.UUID
    name: str
    email: EmailStr
    role: RoleEnum
    college: Optional[str] = None
    xp: int
    level: int