
from datetime import timedelta
from math import sqrt
from statistics import mean

from app.elexon import utc_timestamp


def compare_forecasts(
    actual_records: list[dict],
    forecast_records: list[dict],
    decision_time_utc: str = "10:00",
) -> dict:
    try:
        hour, minute = map(int, decision_time_utc.split(":"))
    except (ValueError, AttributeError):
        raise ValueError("Decision time must use HH:MM format.") from None

    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise ValueError("Decision time must use HH:MM format.")

    actual_by_time = {}

    for record in actual_records:
        if record.get("fuelType") != "WIND":
            continue

        start_time = record.get("startTime")
        generation = record.get("generation")

        if start_time is None or generation is None:
            continue

        try:
            timestamp = utc_timestamp(start_time)
            actual_by_time[timestamp] = float(generation)
        except (TypeError, ValueError):
            continue

    forecasts_by_time = {}

    for record in forecast_records:
        start_time = record.get("startTime")
        publish_time = record.get("publishTime")
        generation = record.get("generation")

        if start_time is None or publish_time is None or generation is None:
            continue

        try:
            target_time = utc_timestamp(start_time)
            published_at = utc_timestamp(publish_time)
            predicted = float(generation)
        except (TypeError, ValueError):
            continue

        if target_time not in forecasts_by_time:
            forecasts_by_time[target_time] = []

        forecasts_by_time[target_time].append(
            {
                "published_at": published_at,
                "generation": predicted,
            }
        )

    comparisons = []

    for target_time in sorted(actual_by_time):
        delivery_day = target_time.date()
        cutoff = utc_timestamp(
            f"{delivery_day.isoformat()}T{hour:02d}:{minute:02d}:00Z"
        ) - timedelta(days=1)

        eligible_forecasts = [
            forecast
            for forecast in forecasts_by_time.get(target_time, [])
            if forecast["published_at"] <= cutoff
        ]

        if not eligible_forecasts:
            continue

        selected = max(
            eligible_forecasts,
            key=lambda forecast: forecast["published_at"],
        )

        actual = actual_by_time[target_time]
        predicted = selected["generation"]
        error = predicted - actual

        comparisons.append(
            {
                "startTime": target_time.isoformat(),
                "decision_cutoff": cutoff.isoformat(),
                "publishTime": selected["published_at"].isoformat(),
                "actual": actual,
                "forecast": predicted,
                "error": error,
            }
        )

    if not comparisons:
        return {
            "decision_time_utc": decision_time_utc,
            "matched_intervals": 0,
            "metrics": None,
            "intervals": [],
        }

    errors = [item["error"] for item in comparisons]

    return {
        "decision_time_utc": decision_time_utc,
        "matched_intervals": len(comparisons),
        "metrics": {
            "mae": mean(abs(error) for error in errors),
            "rmse": sqrt(mean(error ** 2 for error in errors)),
            "bias": mean(errors),
        },
        "intervals": comparisons,
    }
