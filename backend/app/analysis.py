
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
    forecast_minutes = set()

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

        forecast_minutes.add(target_time.minute)
        forecasts_by_time.setdefault(target_time, []).append(
            {
                "published_at": published_at,
                "generation": predicted,
            }
        )

    hourly_mode = (
        forecast_minutes == {0}
        and any(timestamp.minute == 30 for timestamp in actual_by_time)
    )

    if hourly_mode:
        actual_groups = {}

        for timestamp, generation in actual_by_time.items():
            hour_start = timestamp.replace(minute=0, second=0, microsecond=0)
            actual_groups.setdefault(hour_start, []).append(
                (timestamp, generation)
            )

        comparison_actuals = {}

        for hour_start, readings in actual_groups.items():
            readings.sort(key=lambda item: item[0])

            if (
                len(readings) == 2
                and [item[0].minute for item in readings] == [0, 30]
            ):
                comparison_actuals[hour_start] = mean(
                    item[1] for item in readings
                )
    else:
        comparison_actuals = actual_by_time

    comparisons = []

    for target_time in sorted(comparison_actuals):
        cutoff = utc_timestamp(
            f"{target_time.date().isoformat()}T{hour:02d}:{minute:02d}:00Z"
        ) - timedelta(days=1)

        eligible = [
            forecast
            for forecast in forecasts_by_time.get(target_time, [])
            if forecast["published_at"] <= cutoff
        ]

        if not eligible:
            continue

        selected = max(eligible, key=lambda item: item["published_at"])
        actual = comparison_actuals[target_time]
        predicted = selected["generation"]

        comparisons.append(
            {
                "startTime": target_time.isoformat(),
                "decision_cutoff": cutoff.isoformat(),
                "publishTime": selected["published_at"].isoformat(),
                "actual": actual,
                "forecast": predicted,
                "error": predicted - actual,
            }
        )

    if not comparisons:
        return {
            "decision_time_utc": decision_time_utc,
            "comparison_resolution": "hourly" if hourly_mode else "source_interval",
            "matched_intervals": 0,
            "metrics": None,
            "intervals": [],
        }

    errors = [item["error"] for item in comparisons]

    return {
        "decision_time_utc": decision_time_utc,
        "comparison_resolution": "hourly" if hourly_mode else "source_interval",
        "matched_intervals": len(comparisons),
        "metrics": {
            "mae": mean(abs(error) for error in errors),
            "rmse": sqrt(mean(error ** 2 for error in errors)),
            "bias": mean(errors),
        },
        "intervals": comparisons,
    }
