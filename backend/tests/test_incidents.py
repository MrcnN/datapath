"""tests/test_incidents.py — Deadlock XML parsing & incidents tests."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_DEADLOCK_XML = """
<deadlock>
 <victim-list>
  <victimProcess id="process1470" />
 </victim-list>
 <process-list>
  <process id="process1470" currentdb="10" loginname="user1" hostname="APP-SRV1" waittype="LCK_M_X">
   <inputbuf>UPDATE Orders SET Status = 'Processing' WHERE OrderID = 101</inputbuf>
  </process>
  <process id="process2890" currentdb="10" loginname="user2" hostname="APP-SRV2" waittype="LCK_M_S">
   <inputbuf>SELECT * FROM Orders WHERE OrderID = 101</inputbuf>
  </process>
 </process-list>
 <resource-list>
  <keylock objectname="Orders" mode="X">
   <waiter-list>
    <waiter id="process1470" mode="X" />
   </waiter-list>
  </keylock>
 </resource-list>
</deadlock>
"""


def test_parse_deadlock_xml_success():
    payload = {"xml_content": SAMPLE_DEADLOCK_XML}
    res = client.post("/api/deadlocks/parse", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "process1470" in data["victims"]
    assert len(data["processes"]) == 2
    assert len(data["resources"]) == 1
    assert data["processes"][0]["login"] == "user1"
    assert "UPDATE Orders" in data["processes"][0]["sql_text"]


def test_parse_deadlock_invalid_xml():
    payload = {"xml_content": "<invalid>XML</invalid>"}
    res = client.post("/api/deadlocks/parse", json=payload)
    assert res.status_code == 400


def test_read_deadlock_history():
    res = client.get("/api/incidents/deadlocks/history?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "id" in first
    assert "victim_id" in first
    assert "deadlock_xml" in first
    assert "<deadlock" in first["deadlock_xml"]


def test_simulate_lock_endpoint():
    payload = {
        "simulation_type": "BLOCKING",
        "duration_seconds": 5,
        "target_database": "Datapath_TestDB"
    }
    res = client.post("/api/incidents/simulate-lock", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["simulation_type"] == "BLOCKING"
    assert "status" in data
    assert "message" in data
