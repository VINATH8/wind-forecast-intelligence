from fastapi import FastAPI
from app.routes import router

app = FastAPI(
    title="spark",
    description="UK wind generation forecast intelligence",
    version="0.1.0",
)

app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "spark"}
