import uuid

from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

from src.models.user import RoleEnum, User
from src.db.session import get_db
from src.core.security import decode_access_token

# tokenUrl must match your login route: prefix "/auth" + "/login"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

def get_current_user(token,db: Session = Depends(get_db))-> User:

    try:
        payload = decode_access_token(token)
        print(payload)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        # InvalidTokenError also covers ExpiredSignatureError.
        # KeyError: no "sub" claim. ValueError: "sub" isn't a valid UUID.
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_error

    return user
        


def require_role(*allowed_roles: RoleEnum):
    """Returns a dependency that only lets users with one of the given roles through."""

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to do this",
            )
        return current_user

    return role_checker

    