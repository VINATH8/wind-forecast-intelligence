
import pytest

from app.analysis import compare_forecasts


def test_selects_latest_forecast_before_each_delivery_cutoff():
    actuals = [
        {
            "fuelType": "WIND",
            "startTime": "2026-01-10T12:00:00Z",
            "generation": 100,
        },
        {
            "fuelType": "WIND",
            "startTime": "2026-01-11T12:00:00Z",
            "generation": 200,
        },
    ]

    forecasts = [
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-08T09:00:00Z",
            "generation": 90,
        },
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-09T09:30:00Z",
            "generation": 95,
        },
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-09T10:01:00Z",
            "generation": 999,
        },
        {
            "startTime": "2026-01-11T12:00:00Z",
            "publishTime": "2026-01-10T09:45:00Z",
            "generation": 180,
        },
    ]

    result = compare_forecasts(actuals, forecasts)

    assert result["matched_intervals"] == 2
    assert result["intervals"][0]["forecast"] == 95
    assert result["intervals"][0]["decision_cutoff"] == (
        "2026-01-09T10:00:00+00:00"
    )
    assert result["intervals"][1]["forecast"] == 180
    assert result["intervals"][1]["decision_cutoff"] == (
        "2026-01-10T10:00:00+00:00"
    )


def test_ignores_non_wind_actuals():
    actuals = [
        {
            "fuelType": "GAS",
            "startTime": "2026-01-10T12:00:00Z",
            "generation": 100,
        }
    ]

    forecasts = [
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-09T09:00:00Z",
            "generation": 90,
        }
    ]

    result = compare_forecasts(actuals, forecasts)

    assert result["matched_intervals"] == 0
    assert result["metrics"] is None


def test_returns_no_metrics_without_eligible_forecast():
    actuals = [
        {
            "fuelType": "WIND",
            "startTime": "2026-01-10T12:00:00Z",
            "generation": 100,
        }
    ]

    forecasts = [
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-09T10:01:00Z",
            "generation": 90,
        }
    ]

    result = compare_forecasts(actuals, forecasts)

    assert result["matched_intervals"] == 0
    assert result["metrics"] is None
    assert result["intervals"] == []


def test_calculates_error_metrics():
    actuals = [
        {
            "fuelType": "WIND",
            "startTime": "2026-01-10T12:00:00Z",
            "generation": 100,
        },
        {
            "fuelType": "WIND",
            "startTime": "2026-01-10T12:30:00Z",
            "generation": 200,
        },
    ]

    forecasts = [
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-09T09:00:00Z",
            "generation": 110,
        },
        {
            "startTime": "2026-01-10T12:30:00Z",
            "publishTime": "2026-01-09T09:00:00Z",
            "generation": 180,
        },
    ]

    result = compare_forecasts(actuals, forecasts)

    assert result["matched_intervals"] == 2
    assert result["metrics"]["mae"] == 15
    assert result["metrics"]["rmse"] == pytest.approx(250 ** 0.5)
    assert result["metrics"]["bias"] == -5


@pytest.mark.parametrize(
    "decision_time",
    ["25:00", "10:60", "invalid", "10"],
)
def test_rejects_invalid_decision_time(decision_time):
    with pytest.raises(ValueError):
        compare_forecasts([], [], decision_time)

def test_aligns_half_hour_actuals_with_hourly_forecast():
    actuals = [
        {
            "fuelType": "WIND",
            "startTime": "2026-01-10T12:00:00Z",
            "generation": 100,
        },
        {
            "fuelType": "WIND",
            "startTime": "2026-01-10T12:30:00Z",
            "generation": 200,
        },
    ]

    forecasts = [
        {
            "startTime": "2026-01-10T12:00:00Z",
            "publishTime": "2026-01-09T09:00:00Z",
            "generation": 160,
        }
    ]

    result = compare_forecasts(actuals, forecasts)

    assert result["comparison_resolution"] == "hourly"
    assert result["matched_intervals"] == 1
    assert result["intervals"][0]["actual"] == 150
    assert result["intervals"][0]["forecast"] == 160
    assert result["metrics"]["mae"] == 10
    assert result["metrics"]["bias"] == 10
