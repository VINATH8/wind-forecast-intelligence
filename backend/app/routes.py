from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.elexon import fetch_dataset, utc_timestamp

router = APIRouter(prefix="/api")

@router.get("/data/inspect")
def inspect_january_data():
    start = utc_timestamp("2026-01-01T00:00:00Z")
    end = utc_timestamp("2026-02-01T00:00:00Z")

    try:
        actuals = fetch_dataset("actuals", start, end)
        forecasts = fetch_dataset("forecasts", start, end)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon data retrieval failed: {exc}",
        ) from exc

    return {
        "period": {
            "from": start.isoformat(),
            "to_exclusive": end.isoformat(),
        },
        "actuals": {
            "count": len(actuals),
            "fields": sorted(actuals[0].keys()) if actuals else [],
            "sample": actuals[:2],
        },
        "forecasts": {
            "count": len(forecasts),
            "fields": sorted(forecasts[0].keys()) if forecasts else [],
            "sample": forecasts[:2],
        },
        "source": "Elexon BMRS API",
    }
