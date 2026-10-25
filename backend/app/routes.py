from fastapi import APIRouter, HTTPException

from app.analysis import compare_forecasts
from app.elexon import fetch_dataset, utc_timestamp

router = APIRouter(prefix="/api")


@router.get("/data/inspect")
def inspect_january_data():
    start = utc_timestamp("2026-01-01T00:00:00Z")
    end = utc_timestamp("2026-02-01T00:00:00Z")
    forecast_start = utc_timestamp("2025-12-31T00:00:00Z")

    try:
        actuals = fetch_dataset("actuals", start, end)
        forecasts = fetch_dataset("forecasts", forecast_start, end)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon data retrieval failed: {exc}",
        ) from exc

    actuals = [
        record
        for record in actuals
        if record.get("fuelType") == "WIND"
        and record.get("startTime")
        and start <= utc_timestamp(record["startTime"]) < end
    ]

    forecasts = [
        record
        for record in forecasts
        if record.get("publishTime")
        and forecast_start <= utc_timestamp(record["publishTime"]) < end
    ]

    return {
        "period": {
            "from": start.isoformat(),
            "to_exclusive": end.isoformat(),
            "forecast_publication_from": forecast_start.isoformat(),
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


@router.get("/analysis/january-2026")
def analyse_january_data():
    start = utc_timestamp("2026-01-01T00:00:00Z")
    end = utc_timestamp("2026-02-01T00:00:00Z")
    forecast_start = utc_timestamp("2025-12-31T00:00:00Z")

    try:
        actuals = fetch_dataset("actuals", start, end)
        forecasts = fetch_dataset("forecasts", forecast_start, end)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon data retrieval failed: {exc}",
        ) from exc

    actuals = [
        record
        for record in actuals
        if record.get("fuelType") == "WIND"
        and record.get("startTime")
        and start <= utc_timestamp(record["startTime"]) < end
    ]

    forecasts = [
        record
        for record in forecasts
        if record.get("publishTime")
        and forecast_start <= utc_timestamp(record["publishTime"]) < end
    ]

    result = compare_forecasts(actuals, forecasts)

    expected_actuals = 31 * 48
    expected_hourly_intervals = 31 * 24
    matched = result["matched_intervals"]

    return {
        "period": {
            "from": start.isoformat(),
            "to_exclusive": end.isoformat(),
        },
        "source": "Elexon BMRS API",
        "decision_time_utc": result["decision_time_utc"],
        "comparison_resolution": result["comparison_resolution"],
        "data_quality": {
            "actual_intervals_retrieved": len(actuals),
            "expected_half_hourly_actuals": expected_actuals,
            "forecast_records_retrieved": len(forecasts),
            "matched_intervals": matched,
            "expected_hourly_intervals": expected_hourly_intervals,
            "coverage_percent": round(
                matched / expected_hourly_intervals * 100, 2
            ),
            "unmatched_hourly_intervals": expected_hourly_intervals - matched,
        },
        "metrics": result["metrics"],
        "intervals": result["intervals"],
    }
