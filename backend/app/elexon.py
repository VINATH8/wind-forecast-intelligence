from datetime import datetime, timezone
import httpx
BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
DATASETS = {
    "actuals": "FUELHH",
    "forecasts": "WINDFOR",
}

def utc_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamps must include a timezone.")
    return parsed.astimezone(timezone.utc)


def fetch_dataset(
    dataset: str,
    start: datetime,
    end: datetime,
) -> list[dict]:
    if dataset not in DATASETS:
        raise ValueError(f"Unsupported dataset: {dataset}")

    if start >= end:
        raise ValueError("Start must be earlier than end.")

    params = {
        "from": start.isoformat().replace("+00:00", "Z"),
        "to": end.isoformat().replace("+00:00", "Z"),
    }

    if dataset == "actuals":
        params["fuelType"] = "WIND"

    url = f"{BASE_URL}/datasets/{DATASETS[dataset]}/stream"

    with httpx.Client(timeout=60.0) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        records = payload.get("data", [])
    else:
        raise ValueError("Unexpected Elexon response format.")

    if not isinstance(records, list):
        raise ValueError("Expected a list of dataset records.")

    return records
