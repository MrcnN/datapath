# Datapath

A read-only database intelligence and observability platform built for Microsoft SQL Server to troubleshoot live incidents, analyze query performance, and audit database health.

## What It Is For

Datapath helps Database Administrators (DBAs) and engineers quickly answer critical operational questions:
- Investigate active sessions and resolve blocking bottlenecks.
- Diagnose deadlocks and analyze execution issues.
- Detect performance regressions using Query Store data.
- Pinpoint missing indexes and identify costly, unused indexes to optimize I/O and storage.
- Diagnose CPU scheduling pressure and analyze wait statistics to isolate server bottlenecks.
- Verify backup recency and ensure disaster recovery readiness.
- Identify schema drift across environments without risky auto-executions.

## Features

- **Live Activity & Blocking Chains:** Real-time session monitoring with automatic root-blocker detection.
- **Deadlock Parser:** Visual analysis of `.xdl` / XML deadlock graphs, victim processes, and lock resources.
- **Query Store Analytics:** Pinpoints expensive queries (CPU, duration, logical reads) and flags performance regressions.
- **Index Intelligence & Health:** DMV-driven missing index detection with impact scoring, unused index pruning, and fragmentation tracking.
- **Wait Statistics & CPU Pressure:** Categorized wait analysis with Signal Wait ratio gauge and tuning recommendations.
- **Backup & RPO Auditing:** Tracks Full, Differential, and Log backup history and evaluates RPO risk.
- **Schema Diff & Comparison:** Detects structural differences between two databases and generates safe, review-only DDL scripts.
- **Security & Permissions Audit:** Inspects logins, database users, and accounts with elevated (`sysadmin`) privileges.
- **Always On AG Monitoring:** Tracks availability group topology, replica sync states, and failover health.
- **DBA Diagnostic Toolkit:** Built-in, searchable library of categorized T-SQL diagnostic scripts.
- **Dark & Light Theme:** First-class dark and light mode toggle with persistent user preference.
- **Safe by Default:** Strictly read-only operations with no automated modifications.
