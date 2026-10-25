from datetime import datetime, timezone
import pytest
from app.elexon import fetch_dataset, utc_timestamp


def test_utc_timestamp_converts_offset():
    result = utc_timestamp("2026-01-01T01:00:00+01:00")

    assert result == datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_utc_timestamp_rejects_missing_timezone():
    with pytest.raises(ValueError):
        utc_timestamp("2026-01-01T00:00:00")


def test_unknown_dataset_is_rejected():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = datetime(2026, 1, 2, tzinfo=timezone.utc)

    with pytest.raises(ValueError):
        fetch_dataset("UNKNOWN", start, end)


def test_start_must_precede_end():
    start = datetime(2026, 1, 2, tzinfo=timezone.utc)
    end = datetime(2026, 1, 1, tzinfo=timezone.utc)

    with pytest.raises(ValueError):
        fetch_dataset("actuals", start, end)
