# Diagnose Local Swagger Conflicts

This script checks local API endpoint availability and helps identify port/listener conflicts, especially when Swagger works for some services and times out for others.

Script path:
- `scripts/diagnose-local-swagger-conflicts.ps1`

## What It Diagnoses

- Which processes are listening on service ports (`5001`, `5002`, `5003`, `5004` by default)
- `/health`, `/swagger/index.html`, and `/swagger/v1/swagger.json` for each service
- Differences between:
  - `localhost`
  - `127.0.0.1`
  - host primary IPv4
- Likely loopback conflicts (for example, Aspire `dcp.exe` binding loopback)
- Ports with no listeners

## Cross-Platform Support

The script is designed for PowerShell 7+ and works on:
- Windows
- Linux

Implementation notes:
- Listener discovery:
  - Windows: `Get-NetTCPConnection`
  - Linux: `ss` (preferred), `lsof` fallback
- Process details:
  - Windows: `Get-Process` + `Get-CimInstance Win32_Process`
  - Linux: `Get-Process` + `/proc/<pid>/cmdline` fallback

## Usage

From repository root:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/diagnose-local-swagger-conflicts.ps1
```

### Parameters

- `-Ports <int[]>`
  - Custom list of ports.
- `-TimeoutSeconds <int>`
  - HTTP timeout per request.
- `-KillDcpConflicts`
  - Safely stops only detected loopback `dcp.exe` conflicts.
- `-KillConflictingProcesses`
  - Enables aggressive conflict resolution for listeners on target ports.
- `-Force`
  - Required together with `-KillConflictingProcesses` to actually terminate processes.

Examples:

```powershell
# Standard diagnosis
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/diagnose-local-swagger-conflicts.ps1

# Diagnose custom ports
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/diagnose-local-swagger-conflicts.ps1 -Ports 5001,5003

# Safe kill mode (only dcp loopback conflicts)
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/diagnose-local-swagger-conflicts.ps1 -KillDcpConflicts

# Aggressive kill mode (all listeners on target ports, except current script process)
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/diagnose-local-swagger-conflicts.ps1 -KillConflictingProcesses -Force
```

## Conflict Resolution Strategy

When conflict pattern is detected (`localhost` fails but host IP succeeds):

1. Script reports likely loopback conflict.
2. If `-KillDcpConflicts` is set, it stops only detected `dcp.exe` loopback listener processes.
3. If `-KillConflictingProcesses -Force` is set, it stops all listener processes found on target ports (aggressive mode).

## Exit Codes

- `0`: no critical localhost failures for `/health` or `/swagger/index.html`
- `1`: one or more critical localhost checks failed

## IDE Integration

- VS Code task available: `diagnose-local-swagger-conflicts`
- Rider / Visual Studio 2026: run the same command in terminal or configure as external tool

## Safety Notes

- Prefer running without kill switches first.
- Use `-KillDcpConflicts` before aggressive mode.
- Use `-KillConflictingProcesses -Force` only when you are sure the target processes are disposable in your current session.
