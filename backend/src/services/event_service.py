import uuid
from datetime import datetime, timezone
from math import cos, radians

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.models.event import Event, EventCategory
from src.models.registration import Registration, RegistrationStatus
from src.schema.event import EventCreate
from src.utils.geocode import geocode_address

EARTH_RADIUS_KM = 6371.0088
KM_PER_DEGREE_LATITUDE = 111.32


class EventNotFoundError(Exception):
    pass

def create_event(db:Session, payload: EventCreate, organizer_id: uuid.UUID) ->Event:

    coords = geocode_address(payload.venue)
    lat, lng = coords if coords else (None, None)
    event = Event(
        **payload.model_dump(),
        organizer_id=organizer_id,
        latitude=lat,
        longitude=lng,
    )
    if event == None:
        raise ValueError("Failed to create event.")
    
    db.add(event)
    try:
     db.commit()
    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to create event: {e}")
    db.refresh(event)

    return event


def _longitude_bounds(lng: float, longitude_delta: float) -> tuple[float, float, bool]:
    west = lng - longitude_delta
    east = lng + longitude_delta

    if west < -180:
        return west + 360, east, True
    if east > 180:
        return west, east - 360, True
    return west, east, False


def _distance_km_expression(lat: float, lng: float):
    return EARTH_RADIUS_KM * 2 * func.asin(
        func.sqrt(
            func.pow(func.sin((func.radians(Event.latitude) - radians(lat)) / 2), 2)
            + cos(radians(lat))
            * func.cos(func.radians(Event.latitude))
            * func.pow(func.sin((func.radians(Event.longitude) - radians(lng)) / 2), 2)
        )
    )


def _attach_spots_left(db: Session, events: list[Event]) -> list[Event]:
    if not events:
        return events

    counts = dict(
        db.query(Registration.event_id, func.count(Registration.id))
        .filter(
            Registration.event_id.in_([event.id for event in events]),
            Registration.status == RegistrationStatus.confirmed,
        )
        .group_by(Registration.event_id)
        .all()
    )

    for event in events:
        event.spots_left = max(event.capacity - int(counts.get(event.id, 0)), 0)

    return events


def list_events(
    db: Session,
    category: EventCategory | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[Event]:
    query = db.query(Event).filter(Event.end_time >= datetime.now(timezone.utc))
    if category:
        query = query.filter(Event.category == category)

    if lat is not None or lng is not None or radius_km is not None:
        if lat is None or lng is None:
            raise ValueError("lat and lng must be provided together.")

        query = query.filter(
            Event.latitude.isnot(None),
            Event.longitude.isnot(None),
        )

        if radius_km is not None:
            latitude_delta = radius_km / KM_PER_DEGREE_LATITUDE
            south = max(-90, lat - latitude_delta)
            north = min(90, lat + latitude_delta)

            query = query.filter(Event.latitude.between(south, north))

            latitude_cosine = abs(cos(radians(lat)))
            if latitude_cosine > 0.000001:
                longitude_delta = radius_km / (KM_PER_DEGREE_LATITUDE * latitude_cosine)
                if longitude_delta < 180:
                    west, east, crosses_antimeridian = _longitude_bounds(lng, longitude_delta)
                    if crosses_antimeridian:
                        query = query.filter(or_(Event.longitude >= west, Event.longitude <= east))
                    else:
                        query = query.filter(Event.longitude.between(west, east))

        distance_km = _distance_km_expression(lat, lng).label("distance_km")
        query = query.add_columns(distance_km)
        if radius_km is not None:
            query = query.filter(distance_km <= radius_km)

        rows = query.order_by(distance_km, Event.start_time).offset(offset).limit(limit).all()

        events: list[Event] = []
        for event, distance in rows:
            event.distance_km = float(distance)
            events.append(event)
        return _attach_spots_left(db, events)

    events = query.order_by(Event.start_time).offset(offset).limit(limit).all()
    return _attach_spots_left(db, events)

def get_event(db: Session, event_id: uuid.UUID) -> Event:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise EventNotFoundError("Event not found")
    return _attach_spots_left(db, [event])[0]
