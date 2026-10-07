from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models here so Base.metadata knows about every table
# (needed for Base.metadata.create_all() to create them)
from src.models.user import User
# from src.models.event import Event
# from src.models.team import Team
# from src.models.registration import Registration
# from src.models.badge import Badge
# from src.models.xp_transaction import XpTransaction