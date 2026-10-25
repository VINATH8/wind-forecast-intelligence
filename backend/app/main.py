
from fastapi import FastAPI

app = FastAPI(
    title="spark",
    description="UK wind generation forecast intelligence",
    version="0.1.0",
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "spark"}
