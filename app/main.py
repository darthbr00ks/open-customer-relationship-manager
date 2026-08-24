from fastapi import FastAPI

from app.routers import (
    cases,
    deals,
    entities,
    entity_persons,
    incident_cases,
    incidents,
    persons,
    requests,
)

app = FastAPI(
    title="Open RM",
    description="An open relationship management tool",
    version="0.1.0",
)

app.include_router(entities.router, prefix="/api/v1")
app.include_router(persons.router, prefix="/api/v1")
app.include_router(entity_persons.router, prefix="/api/v1")
app.include_router(deals.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(incident_cases.router, prefix="/api/v1")
app.include_router(requests.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
