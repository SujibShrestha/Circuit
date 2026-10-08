from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.schema.user import UserCreate
from src.models.user import User
from src.core.security import hash_password,verify_password


class EmailAlreadyExistsError(Exception):
    pass

def register_user(db,payload: UserCreate):

    existing_user = db.query(User).filter(User.email ==payload.email).first()
    if existing_user:
        raise ValueError("User with this email already exists.")

    user = User(
        name=payload.name.strip(),
        email=payload.email,
        password=hash_password(payload.password),
        role=payload.role,
        college=payload.college,
    )

    db.add(user)
    try:
        db.commit() 
    except IntegrityError:
        db.rollback()
        raise EmailAlreadyExistsError("User with this email already exists.")
    db.refresh(user)

    return user



def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower().strip()).first()

    # same result for "no such email" and "wrong password" on purpose
    if not user or not verify_password(password, user.password):
        return None

    return user