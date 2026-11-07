# Circuit

A campus events platform: students discover and register for events, organizers host them, and everyone earns XP that ranks them on a leaderboard.

**Stack:** FastAPI · SQLAlchemy · PostgreSQL · React 19 · TypeScript · Vite · Tailwind CSS 4 · React-Leaflet

```
circuit/
├── backend/    FastAPI app (routes → controller → service → schema)
└── frontend/   React + Vite SPA
```

## Features

**Students**
- Explore events on an interactive map, filtered by category, location and radius
- Register, cancel, and join a waitlist when an event is full — waitlisted people are promoted automatically when a spot frees up
- Create or join teams for team events (leave anytime)
- Earn XP: **+100** for signing up, **+15** for attending, **+100 / +75 / +50** for 1st / 2nd / 3rd place
- Track level progress and read a full XP history showing where every point came from
- Compete on a global or college-scoped leaderboard

**Organizers**
- Publish events with venue geocoding, so they appear on the Explore map
- Mark attendees as attended
- Post results once an event ends, awarding placement XP to the right people

## XP & levels

XP is written to an `xp_transactions` ledger and mirrored onto `users.xp`. Level is derived, never stored:

```
level = floor(sqrt(xp / 50)) + 1      # level 1: 0, level 2: 50, level 3: 200, level 4: 450, ...
```

Awards are **idempotent** — the ledger has a unique constraint on `(user_id, event_id, reason)`, so replaying a request never double-pays.

## Notable engineering

- **No overselling.** Registration takes a `SELECT ... FOR UPDATE` row lock on the event, so concurrent signups for the last spot serialize instead of both succeeding.
- **Savepoints, not swallowed errors.** A failed ledger insert runs inside `begin_nested()`, so it can't poison the surrounding transaction.
- **Validate first, pay last.** `post_results` checks every place, target and attendance requirement before awarding a single XP.
- **Total ordering for ranks.** The leaderboard orders by `(xp, created_at, id)`, so ranks are stable and tie-broken deterministically.

## Getting started

### Prerequisites

- Python 3.10+ (code uses `X | None` union syntax), Node 18+
- A PostgreSQL database

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```ini
DATABASE_URL = 'postgresql://user:password@host:5432/dbname?sslmode=require'
JWT_SECRET_KEY = '<random hex string>'
JWT_ALGORITHM = 'HS256'
```

> `.env` is gitignored — never commit it.

Run:

```bash
uvicorn src.main:app --reload
```

Tables are created automatically on startup (`Base.metadata.create_all`). See [Limitations](#limitations) for why this doesn't cover schema *changes*.

API docs: <http://127.0.0.1:8000/docs> · health check: <http://127.0.0.1:8000/health>

### Frontend

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env` points the app at the API:

```ini
VITE_BACKEND_URL=http://localhost:8000
```

Open <http://localhost:5173>.

### Useful scripts

| Command | Where | Does |
|---|---|---|
| `npm run build` | `frontend/` | Type-check + production build |
| `npm run lint` | `frontend/` | ESLint |
| `python migrate_xp_event_nullable.py` | `backend/` | Idempotent one-off migration (see below) |
| `python smoke_test_xp.py` | `backend/` | Signup bonus + XP ledger test (needs a running server) |
| `python smoke_test_results.py` | `backend/` | Full register → attend → post results flow (needs a running server) |

The smoke tests expect the API on `http://127.0.0.1:8077`:

```bash
uvicorn src.main:app --port 8077
python smoke_test_xp.py
python smoke_test_results.py
```

## API overview

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Creates the account and awards the 100 XP signup bonus |
| POST | `/auth/login` | Returns a JWT |
| GET | `/auth/me` | Current user, with `xp`, `level`, `xp_into_level`, `xp_for_next_level` |
| GET | `/auth/me/xp` | XP ledger, newest first |
| GET | `/events/` | Filter by `category`, `lat`/`lng`/`radius_km`, `limit`, `offset` |
| POST | `/events/` | Organizer only |
| POST | `/registrations/` | Register (or join the waitlist if full) |
| DELETE | `/registrations/{id}` | Cancels and promotes the next waitlisted person |
| POST | `/events/{id}/attendees/{user_id}/attend` | Organizer only, awards attendance XP |
| POST | `/events/{id}/results` | Organizer only, after the event ends |
| POST | `/teams` | Create a team (event must allow teams) |
| POST | `/teams/{id}/join` | Join a team |
| DELETE | `/teams/{id}/members/me` | Leave your team |
| GET | `/leaderboard?scope=global\|college&limit=50` | Top users by XP; `college` scopes to your own |

Interactive documentation with every schema lives at `/docs`.

## Project structure

```
backend/src/
├── routes/        URL definitions and status codes
├── controller/    Request/response mapping, error → HTTP translation
├── services/      Business logic (registration, teams, XP, events, leaderboard)
├── schema/        Pydantic request/response models
├── models/        SQLAlchemy models
├── core/          Security (JWT, password hashing)
└── db/            Engine, session, model registry

frontend/
├── pages/         Route components (Explore, EventDetail, Leaderboard, Profile, ...)
├── components/    Navbar, EventForm, ProtectedRoute
├── context/       AuthContext (login/register/current user)
├── hooks/         useRegistrations
└── api/           Axios client with JWT interceptor
```

## Limitations

Honest list of what's not there yet:

- **No migration tool.** `alembic` is in `requirements.txt` but unconfigured. Startup only runs `create_all`, which creates missing tables and never alters existing ones. `migrate_xp_event_nullable.py` is a hand-written stopgap for one such change. Moving to Alembic is the fix.
- **Tests are two manual smoke scripts**, not a test suite. There's no CI.
- **CORS is wide open** (`allow_origins=["*"]`) — fine for local dev, must be restricted for production.
- **Password reset is not implemented**; the UI directs users to a campus administrator.
- **Event creation geocodes the venue** at publish time via an external lookup; a non-geocodable venue still saves, but the event won't show on the map.

## License

Not specified.
