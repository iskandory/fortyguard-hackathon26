import os
import time
from typing import Optional

import requests

BASE_URL = "https://api.fortyguard.com"
POLL_INTERVAL_SECONDS = 4
POLL_TIMEOUT_SECONDS = 300
MAX_LEADING_404_RETRIES = 5


class FortyGuardError(Exception):
    pass


class FortyGuardClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ["FORTYGUARD_API_KEY"]
        self.session = requests.Session()
        self.session.headers.update({"api-key": self.api_key, "Content-Type": "application/json"})

    def _submit(self, endpoint: str, payload: dict) -> str:
        resp = self.session.post(f"{BASE_URL}{endpoint}", json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()["data"]["activity_id"]

    def _poll(self, activity_id: str) -> dict:
        deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
        leading_404s = 0
        while time.monotonic() < deadline:
            resp = self.session.get(f"{BASE_URL}/v1/status/{activity_id}", timeout=30)
            if resp.status_code == 404 and leading_404s < MAX_LEADING_404_RETRIES:
                # A 404 immediately after submission is expected and retryable.
                leading_404s += 1
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            resp.raise_for_status()
            body = resp.json()["data"]
            status = body["status"]
            if status == "Completed":
                return body["result"]
            if status == "Failed":
                raise FortyGuardError(f"activity {activity_id} failed: {body}")
            time.sleep(POLL_INTERVAL_SECONDS)
        raise FortyGuardError(f"activity {activity_id} timed out after {POLL_TIMEOUT_SECONDS}s")

    def _run(self, endpoint: str, payload: dict) -> dict:
        activity_id = self._submit(endpoint, payload)
        return self._poll(activity_id)

    def heatmap(
        self,
        polygon_aoi: dict,
        start_date: str,
        filter_type: int = 1,
        granularity: int = 100,
        analytic_type: Optional[str] = None,
        threshold: Optional[float] = None,
        direction: str = "above",
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        date_time = {"start_date": start_date, "filter_type": filter_type}
        if start_time:
            date_time["start_time"] = start_time
        if end_time:
            date_time["end_time"] = end_time
        if end_date:
            date_time["end_date"] = end_date
        payload = {"polygon_aoi": polygon_aoi, "date_time": date_time, "granularity": granularity}
        if analytic_type:
            payload["analytic_type"] = analytic_type
            payload["threshold"] = threshold if threshold is not None else 30
            payload["direction"] = direction
        return self._run("/v1/heatmap", payload)

    def env_params(
        self,
        latitude: float,
        longitude: float,
        temperature: float,
        start_date: str,
        filter_type: int = 1,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        end_date: Optional[str] = None,
        analysis: Optional[list] = None,
    ) -> dict:
        date_time = {"start_date": start_date, "filter_type": filter_type}
        if start_time:
            date_time["start_time"] = start_time
        if end_time:
            date_time["end_time"] = end_time
        if end_date:
            date_time["end_date"] = end_date
        payload = {"latitude": latitude, "longitude": longitude, "temperature": temperature, "date_time": date_time}
        if analysis:
            payload["analysis"] = analysis
        return self._run("/v1/env_params", payload)
