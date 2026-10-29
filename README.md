# Datapath

A read-only database intelligence and observability platform built for Microsoft SQL Server to troubleshoot live incidents, analyze query performance, and audit database health.

## What It Is For

Datapath helps Database Administrators (DBAs) and engineers quickly answer critical operational questions:
- Investigate active sessions, diagnose root blockers, and analyze query execution in real time (`sp_WhoIsActive`-grade).
- Pinpoint missing indexes, detect redundant/duplicate indexes, and prune costly unused indexes to optimize I/O and storage.
- Detect performance regressions, execution plan anti-patterns, and TempDB spills using Query Store data.
- Audit server configuration best practices (`sp_configure`) and measure instance compliance scores.
- Forecast database growth trends and estimate disk capacity depletion runways.
- Identify security vulnerabilities, orphan users, and privilege escalation risks across logins and databases.
- Diagnose deadlocks, analyze execution issues, and trace incident timelines.
- Diagnose CPU scheduling pressure and analyze wait statistics to isolate server bottlenecks.
- Verify backup recency and ensure disaster recovery readiness.
- Identify schema drift across environments without risky auto-executions.

## Features

- **Live Process Explorer & `sp_WhoIsActive` Diagnostics:** Real-time request monitoring with exact statement offset extraction, elapsed execution timers, root-blocker tagging, TempDB / memory grant tracking, open transaction isolation levels, auto-refresh intervals, and review-only KILL scripts.
- **Redundant & Duplicate Index Detection:** Identifies left-prefix index overlaps and identical duplicate indexes to reclaim gigabytes of disk space and eliminate unnecessary write penalties.
- **Security Vulnerability & Privilege Escalation Audit:** Detects orphan database users, accounts with `sysadmin` or `CONTROL SERVER` escalation, insecure guest permissions, and public role exposures.
- **Server Configuration Compliance & DBA Scoring:** Evaluates instance `sp_configure` settings (Cost Threshold for Parallelism, MAXDOP, Optimize for Ad Hoc Workloads, Backup Compression) with compliance scoring and remediation scripts.
- **Storage Growth Runway & Capacity Forecasting:** Analyzes database data and log autogrowth events, projects days until disk depletion, and flags risky percentage-based growth settings.
- **Execution Plan Anti-Patterns & TempDB Spills:** Detects `CONVERT_IMPLICIT` warnings, missing column statistics, large memory grant discrepancies, and Sort/Hash TempDB spills in Query Store plans.
- **SQL Server Agent Job Intelligence:** Tracks job execution outcomes, step-level failure diagnostics, historical run durations, and job status.
- **Deadlock Parser:** Visual analysis of `.xdl` / XML deadlock graphs, victim processes, and lock resources.
- **Index Intelligence & Fragmentation:** DMV-driven missing index detection with impact scoring, unused index pruning, and fragmentation tracking.
- **Wait Statistics & CPU Pressure:** Categorized wait analysis with Signal Wait ratio gauge and tuning recommendations.
- **Backup & RPO Auditing:** Tracks Full, Differential, and Log backup history and evaluates RPO risk.
- **Schema Diff & Comparison:** Detects structural differences between two databases and generates safe, review-only DDL scripts.
- **Always On AG Monitoring:** Tracks availability group topology, replica sync states, and failover health.
- **DBA Diagnostic Toolkit:** Built-in, searchable library of categorized T-SQL diagnostic scripts.
- **Dark & Light Theme:** First-class dark and light mode toggle with persistent user preference.
- **Safe by Default:** Strictly read-only operations with no automated modifications.
