import responses
import fortyguard_client
from fortyguard_client import FortyGuardClient, FortyGuardError

BASE_URL = "https://api.fortyguard.com"


@responses.activate
def test_heatmap_submits_and_polls_to_completion(monkeypatch):
    monkeypatch.setattr(fortyguard_client.time, "sleep", lambda _: None)
    responses.add(
        responses.POST, f"{BASE_URL}/v1/heatmap",
        json={"error": False, "data": {"activity_id": "abc-123"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/abc-123",
        json={"data": {"activity_id": "abc-123", "status": "Processing"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/abc-123",
        json={
            "data": {
                "activity_id": "abc-123",
                "status": "Completed",
                "result": {"stats_data": {"Temperature_stats": {"Mean": 31.2}}},
            }
        },
        status=200,
    )

    client = FortyGuardClient(api_key="test-key")
    result = client.heatmap(
        polygon_aoi={"type": "FeatureCollection", "features": []},
        start_date="2026-08-01", filter_type=1, start_time="14:00",
    )

    assert result["stats_data"]["Temperature_stats"]["Mean"] == 31.2


@responses.activate
def test_failed_activity_raises(monkeypatch):
    monkeypatch.setattr(fortyguard_client.time, "sleep", lambda _: None)
    responses.add(
        responses.POST, f"{BASE_URL}/v1/heatmap",
        json={"data": {"activity_id": "bad-1"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/bad-1",
        json={"data": {"activity_id": "bad-1", "status": "Failed"}}, status=200,
    )

    client = FortyGuardClient(api_key="test-key")
    try:
        client.heatmap(polygon_aoi={"type": "FeatureCollection", "features": []}, start_date="2026-08-01")
        assert False, "expected FortyGuardError"
    except FortyGuardError:
        pass


@responses.activate
def test_env_params_sends_the_documented_shape(monkeypatch):
    monkeypatch.setattr(fortyguard_client.time, "sleep", lambda _: None)
    responses.add(
        responses.POST, f"{BASE_URL}/v1/env_params",
        json={"data": {"activity_id": "env-1"}}, status=200,
    )
    responses.add(
        responses.GET, f"{BASE_URL}/v1/status/env-1",
        json={
            "data": {
                "activity_id": "env-1",
                "status": "Completed",
                "result": {
                    "metadata": {"timestamps": ["2026-08-22T14:00:00+00:00"]},
                    "locations": [{"parameters": {"wet_bulb_temperature_celsius": [24.1]}}],
                },
            }
        },
        status=200,
    )

    client = FortyGuardClient(api_key="test-key")
    result = client.env_params(
        latitude=39.04, longitude=-77.48, temperature=31.2,
        start_date="2026-08-22", filter_type=1, start_time="14:00",
        analysis=["wet_bulb_temperature_celsius"],
    )

    sent_body = responses.calls[0].request.body
    assert b'"temperature": 31.2' in sent_body or b'"temperature":31.2' in sent_body
    assert result["locations"][0]["parameters"]["wet_bulb_temperature_celsius"] == [24.1]
