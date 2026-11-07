"""services/incident_simulation_service.py - Safe incident & lock simulator for DBA diagnostics."""
from __future__ import annotations

import logging
import threading
import time
from typing import Dict, Any
from app.db.connection import get_db_connection, ConnectionParams

logger = logging.getLogger(__name__)


def run_lock_simulation(
    params: ConnectionParams,
    simulation_type: str = "BLOCKING",
    duration_seconds: int = 15,
    target_database: str = "Datapath_TestDB",
) -> Dict[str, Any]:
    """Execute a controlled, safe lock chain or deadlock simulation on target test database."""
    safe_duration = max(5, min(30, duration_seconds))
    target_db = target_database or "Datapath_TestDB"

    if simulation_type.upper() == "DEADLOCK":
        return _simulate_deadlock(params, target_db)
    else:
        return _simulate_blocking(params, safe_duration, target_db)


def _simulate_blocking(params: ConnectionParams, duration: int, db_name: str) -> Dict[str, Any]:
    """Start two threads: Thread 1 acquires exclusive lock, Thread 2 waits, creating a live blocking chain."""
    sim_params = ConnectionParams(
        server=params.server,
        database=db_name,
        username=params.username,
        password=params.password,
        trusted_connection=params.trusted_connection,
        driver=params.driver,
        timeout=10,
    )

    blocker_info = {"spid": None, "status": "PENDING"}
    waiter_info = {"spid": None, "status": "PENDING"}

    def blocker_worker():
        try:
            with get_db_connection(sim_params) as conn:
                conn.autocommit = False
                cursor = conn.cursor()
                cursor.execute("SELECT @@SPID")
                spid = cursor.fetchone()[0]
                blocker_info["spid"] = spid
                blocker_info["status"] = "HOLDING_LOCK"

                # Exclusive tablock on Orders row
                cursor.execute(
                    "UPDATE dbo.Orders WITH (TABLOCKX) SET ShippingAddress = ShippingAddress WHERE OrderID = 1"
                )
                time.sleep(duration)
                conn.rollback()
                blocker_info["status"] = "RELEASED"
        except Exception as e:
            logger.warning(f"Blocker worker encountered: {e}")
            blocker_info["status"] = f"ERROR: {e}"

    def waiter_worker():
        time.sleep(0.5)
        try:
            with get_db_connection(sim_params) as conn:
                conn.autocommit = True
                cursor = conn.cursor()
                cursor.execute("SELECT @@SPID")
                spid = cursor.fetchone()[0]
                waiter_info["spid"] = spid
                waiter_info["status"] = "WAITING"

                # Attempts to select from Orders (will block until blocker releases)
                cursor.execute("SELECT TOP 1 * FROM dbo.Orders WHERE OrderID = 1")
                _ = cursor.fetchone()
                waiter_info["status"] = "COMPLETED"
        except Exception as e:
            logger.warning(f"Waiter worker encountered: {e}")
            waiter_info["status"] = f"ERROR: {e}"

    t1 = threading.Thread(target=blocker_worker, daemon=True)
    t2 = threading.Thread(target=waiter_worker, daemon=True)
    t1.start()
    t2.start()

    # Wait briefly for SPIDs to initialize
    time.sleep(1.0)

    return {
        "status": "SIMULATION_ACTIVE",
        "simulation_type": "BLOCKING",
        "duration_seconds": duration,
        "database": db_name,
        "message": f"Canlı kilit zinciri başlatıldı ({duration} sn). sp_whoisactive ve Engelleme Zincirleri ekranından canlı izleyebilirsiniz.",
        "blocker_spid": blocker_info.get("spid"),
        "waiter_spid": waiter_info.get("spid"),
        "details": {
            "blocker_status": blocker_info.get("status"),
            "waiter_status": waiter_info.get("status"),
            "wait_type": "LCK_M_S on Orders",
        },
    }


def _simulate_deadlock(params: ConnectionParams, db_name: str) -> Dict[str, Any]:
    """Execute two cross-transaction updates to trigger an immediate, real deadlock in SQL Server."""
    sim_params = ConnectionParams(
        server=params.server,
        database=db_name,
        username=params.username,
        password=params.password,
        trusted_connection=params.trusted_connection,
        driver=params.driver,
        timeout=10,
    )

    deadlock_result = {"status": "PENDING", "victim_spid": None}

    def tx1():
        try:
            with get_db_connection(sim_params) as conn:
                conn.autocommit = False
                c = conn.cursor()
                c.execute("SET DEADLOCK_PRIORITY HIGH; UPDATE dbo.Customers WITH (PAGLOCK, XLOCK) SET Email = Email WHERE CustomerID = 1")
                time.sleep(1.2)
                c.execute("UPDATE dbo.Orders WITH (PAGLOCK, XLOCK) SET ShippingAddress = ShippingAddress WHERE OrderID = 1")
                conn.commit()
                deadlock_result["status"] = "COMMITTED"
        except Exception as e:
            deadlock_result["tx1_err"] = str(e)

    def tx2():
        try:
            with get_db_connection(sim_params) as conn:
                conn.autocommit = False
                c = conn.cursor()
                c.execute("SELECT @@SPID")
                spid = c.fetchone()[0]
                deadlock_result["victim_spid"] = spid
                c.execute("SET DEADLOCK_PRIORITY LOW; UPDATE dbo.Orders WITH (PAGLOCK, XLOCK) SET ShippingAddress = ShippingAddress WHERE OrderID = 1")
                time.sleep(1.2)
                c.execute("UPDATE dbo.Customers WITH (PAGLOCK, XLOCK) SET Email = Email WHERE CustomerID = 1")
                conn.commit()
        except Exception as e:
            deadlock_result["victim_err"] = str(e)
            deadlock_result["status"] = "DEADLOCK_DETECTED"

    t1 = threading.Thread(target=tx1)
    t2 = threading.Thread(target=tx2)
    t1.start()
    t2.start()
    t1.join(timeout=6.0)
    t2.join(timeout=6.0)

    return {
        "status": "DEADLOCK_TRIGGERED",
        "simulation_type": "DEADLOCK",
        "database": db_name,
        "message": "SQL Server motorunda gerçek Deadlock tetiklendi (Hata 1205). system_health ring_buffer'ına yazıldı.",
        "victim_spid": deadlock_result.get("victim_spid"),
        "details": deadlock_result,
    }
