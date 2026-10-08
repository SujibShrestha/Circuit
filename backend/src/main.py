from fastapi import FastAPI
from dotenv import load_dotenv
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from src.db.base import Base
from src.db.session import engine
from src.routes import auth_routes

load_dotenv()

app = FastAPI(title="Circuit API")

#MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Dev-only: creates tables from models if they don't exist yet.
    # Doesn't alter existing tables — see our Alembic discussion for when to switch.
    Base.metadata.create_all(bind=engine)


@app.get("/")
async def root():
    return {"message": "Welcome To Circuit API"}

#ROUTES
app.include_router(auth_routes.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3000)