"""tests/test_agent_jobs.py — Unit tests for SQL Server Agent jobs and step history endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_agent_jobs_summary_endpoint():
    response = client.get("/api/agent-jobs/summary")
    assert response.status_code == 200
    data = response.json()
    assert "agent_running" in data
    assert "total_jobs" in data
    assert "enabled_jobs" in data
    assert "failed_jobs_count" in data
    assert "jobs" in data
    assert len(data["jobs"]) > 0

    first_job = data["jobs"][0]
    assert "job_id" in first_job
    assert "name" in first_job
    assert "enabled" in first_job
    assert "last_run_status" in first_job


def test_job_step_history_endpoint():
    # Fetch summary to get a job_id
    summary_resp = client.get("/api/agent-jobs/summary")
    job_id = summary_resp.json()["jobs"][0]["job_id"]

    response = client.get(f"/api/agent-jobs/{job_id}/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first_step = data[0]
        assert "step_id" in first_step
        assert "step_name" in first_step
        assert "run_status" in first_step
        assert "message" in first_step
