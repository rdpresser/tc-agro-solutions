param(
    [string]$Ports = "5001,5002,5003,5004",
    [switch]$KillDcpConflicts,
    [switch]$KillConflictingProcesses,
    [switch]$Force,
    [int]$TimeoutSeconds = 8
)

# Normalize Ports: accept either an array (when called from VS Code task)
# or a comma/space-separated string (when called manually from terminal).
$tempPorts = @()
foreach ($item in ($Ports -split '[,\s]+')) {
    $item = $item.Trim()
    if ([string]::IsNullOrWhiteSpace($item)) { continue }
    $tempPorts += [int]::Parse($item)
}
$Ports = [int[]]$tempPorts

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:CurrentProcessId = $PID

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Get-PrimaryIPv4 {
    $candidates = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object {
            $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
            $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback
        } |
        ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
        Where-Object {
            $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
            -not $_.Address.IPAddressToString.StartsWith("169.254.")
        } |
        Select-Object -ExpandProperty Address |
        ForEach-Object { $_.IPAddressToString }

    $ip = $candidates | Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($ip)) {
        $ip = "127.0.0.1"
    }

    return $ip
}

function Resolve-ProcessInfo {
    param([int]$ProcId)

    try {
        $p = Get-Process -Id $ProcId -ErrorAction Stop
        $name = $p.ProcessName
        $cmd = ""

        if ($IsWindows) {
            $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcId" -ErrorAction SilentlyContinue
            if ($null -ne $wmi -and -not [string]::IsNullOrWhiteSpace($wmi.CommandLine)) {
                $cmd = $wmi.CommandLine
            }
        }
        elseif (Test-Path "/proc/$ProcId/cmdline") {
            $raw = Get-Content -Path "/proc/$ProcId/cmdline" -Raw -ErrorAction SilentlyContinue
            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                $cmd = $raw.Replace([char]0, ' ').Trim()
            }
        }

        if ([string]::IsNullOrWhiteSpace($cmd)) {
            $cmd = $p.Path
        }

        if ([string]::IsNullOrWhiteSpace($cmd)) {
            $cmd = "<command-line unavailable>"
        }

        if ($cmd.Length -gt 120) {
            $cmd = $cmd.Substring(0, 120) + "..."
        }

        return "PID $ProcId [$name] $cmd"
    }
    catch {
        return "PID $ProcId (unresolved: $($_.Exception.Message))"
    }
}

function Get-ListenerRowsWindows {
    param([int[]]$TargetPorts)

    $rows = @()
    foreach ($port in $TargetPorts) {
        $listenEntries = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($entry in @($listenEntries)) {
            $rows += [pscustomobject]@{
                Port = $port
                LocalAddress = $entry.LocalAddress
                ProcessId = [int]$entry.OwningProcess
            }
        }
    }

    return $rows
}

function Get-ListenerRowsFromSs {
    param([int[]]$TargetPorts)

    $rows = @()
    $ss = Get-Command ss -ErrorAction SilentlyContinue
    if ($null -eq $ss) {
        return $rows
    }

    $output = & $ss.Source -ltnp 2>$null
    foreach ($line in @($output)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line -notmatch "LISTEN") {
            continue
        }

        $parts = $line -split "\s+"
        $localToken = if ($parts.Count -ge 5) { $parts[4] } else { "0.0.0.0:*" }
        $localAddress = "0.0.0.0"
        if ($localToken -match "^(?<addr>.+):\d+$") {
            $localAddress = $Matches.addr
        }

        if ($line -match ":(?<port>\d+)\s" -and $line -match "pid=(?<pid>\d+)") {
            $port = [int]$Matches.port
            if ($TargetPorts -contains $port) {
                $rows += [pscustomobject]@{
                    Port = $port
                    LocalAddress = $localAddress
                    ProcessId = [int]$Matches.pid
                }
            }
        }
    }

    return $rows
}

function Get-ListenerRowsFromLsof {
    param([int[]]$TargetPorts)

    $rows = @()
    $lsof = Get-Command lsof -ErrorAction SilentlyContinue
    if ($null -eq $lsof) {
        return $rows
    }

    foreach ($port in $TargetPorts) {
        $output = & $lsof.Source -nP -iTCP:$port -sTCP:LISTEN -Fp 2>$null
        foreach ($line in @($output)) {
            if ($line -match "^p(?<pid>\d+)$") {
                $rows += [pscustomobject]@{
                    Port = $port
                    LocalAddress = "0.0.0.0"
                    ProcessId = [int]$Matches.pid
                }
            }
        }
    }

    return $rows
}

function Get-ListenerRows {
    param($TargetPorts)

    # Normalize: accept string "5001,5003" or "5001 5003" or array
    if ($TargetPorts -is [string]) {
        $TargetPorts = @($TargetPorts -split '[,\s]+' | ForEach-Object { [int]::Parse($_.Trim()) })
    }
    if ($TargetPorts -isnot [System.Collections.IEnumerable]) {
        $TargetPorts = @($TargetPorts)
    }

    if ($IsWindows) {
        return Get-ListenerRowsWindows -TargetPorts $TargetPorts
    }

    $rows = Get-ListenerRowsFromSs -TargetPorts $TargetPorts
    if (@($rows).Count -gt 0) {
        return $rows
    }

    $rows = Get-ListenerRowsFromLsof -TargetPorts $TargetPorts
    return $rows
}

function Stop-ListenersSafely {
    param(
        [Object[]]$ListenerRows,
        [switch]$ForceMode
    )

    $processes = @($ListenerRows | Select-Object -ExpandProperty ProcessId -Unique | Where-Object { $_ -ne $script:CurrentProcessId })
    if ($processes.Count -eq 0) {
        Write-Host "No candidate processes to terminate." -ForegroundColor Yellow
        return
    }

    if (-not $ForceMode) {
        Write-Host "Kill requested without -Force. No process was terminated." -ForegroundColor Yellow
        Write-Host "Add -Force to actually stop listeners on conflicting ports." -ForegroundColor Yellow
        return
    }

    foreach ($procIdToStop in $processes) {
        Write-Host ("Stopping PID {0}" -f $procIdToStop) -ForegroundColor Yellow
        Stop-Process -Id $procIdToStop -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-Endpoint {
    param(
        [string]$EndpointAddress,
        [int]$Port,
        [string]$Path,
        [int]$TimeoutSeconds
    )

    $url = "http://{0}:{1}{2}" -f $EndpointAddress, $Port, $Path

    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSeconds
        return [pscustomobject]@{
            Url = $url
            Ok = $true
            Status = [int]$response.StatusCode
            Error = ""
        }
    }
    catch {
        return [pscustomobject]@{
            Url = $url
            Ok = $false
            Status = 0
            Error = $_.Exception.Message
        }
    }
}

Write-Section "Environment"
Write-Host ("DOCKER_HOST={0}" -f ($env:DOCKER_HOST ?? "<not-set>"))
$machineDockerHost = [System.Environment]::GetEnvironmentVariable("DOCKER_HOST", "Machine")
$userDockerHost = [System.Environment]::GetEnvironmentVariable("DOCKER_HOST", "User")
Write-Host ("Machine DOCKER_HOST={0}" -f ($machineDockerHost ?? "<not-set>"))
Write-Host ("User DOCKER_HOST={0}" -f ($userDockerHost ?? "<not-set>"))

$primaryIp = Get-PrimaryIPv4
Write-Host ("Primary IPv4 used for comparison: {0}" -f $primaryIp)

Write-Section "Listeners"
Write-Host ("DEBUG: Ports type = {0}, value = '{1}'" -f $Ports.GetType().FullName, ($Ports -join ','))
$listenerRows = @(Get-ListenerRows -TargetPorts $Ports)

foreach ($port in $Ports) {
    if ((@($listenerRows | Where-Object { $_.Port -eq $port })).Count -eq 0) {
        Write-Host ("Port {0}: no listener" -f $port) -ForegroundColor Yellow
    }
}

if ($listenerRows.Count -gt 0) {
    $listenerRows |
        Sort-Object Port, LocalAddress, ProcessId |
        Format-Table -AutoSize | Out-String | Write-Host

    Write-Host "Process map:"
    $listenerRows |
        Select-Object -ExpandProperty ProcessId -Unique |
        Sort-Object |
        ForEach-Object { Write-Host (Resolve-ProcessInfo -ProcId $_) }
}

$conflictingDcpRows = @($listenerRows | Where-Object {
    $_.LocalAddress -in @("127.0.0.1", "::1") -and
    (Resolve-ProcessInfo -ProcId $_.ProcessId) -match "\\bdcp\\.exe\\b"
})

if ($conflictingDcpRows.Count -gt 0) {
    Write-Host ""
    Write-Host "Detected local loopback listeners from dcp.exe on service ports:" -ForegroundColor Yellow
    $conflictingDcpRows | Format-Table -AutoSize | Out-String | Write-Host

    if ($KillDcpConflicts) {
        $pidsToKill = $conflictingDcpRows | Select-Object -ExpandProperty ProcessId -Unique
        foreach ($proc in $pidsToKill) {
            Write-Host ("Stopping dcp PID {0}" -f $proc) -ForegroundColor Yellow
            Stop-Process -Id $proc -Force -ErrorAction Stop
        }
    }
}

if ($KillConflictingProcesses) {
    Write-Host ""
    Write-Host "Aggressive conflict resolution is enabled." -ForegroundColor Yellow
    Stop-ListenersSafely -ListenerRows $listenerRows -ForceMode:$Force
}

Write-Section "Endpoint Probe"
$paths = @("/health", "/swagger/index.html", "/swagger/v1/swagger.json")
$hosts = @("localhost", "127.0.0.1", $primaryIp) | Select-Object -Unique

$results = @()
foreach ($port in $Ports) {
    foreach ($endpointAddress in $hosts) {
        foreach ($path in $paths) {
            $results += Invoke-Endpoint -EndpointAddress $endpointAddress -Port $port -Path $path -TimeoutSeconds $TimeoutSeconds
        }
    }
}

$results | ForEach-Object {
    if ($_.Ok) {
        Write-Host ("OK   {0} -> {1}" -f $_.Url, $_.Status) -ForegroundColor Green
    }
    else {
        Write-Host ("FAIL {0} -> {1}" -f $_.Url, $_.Error) -ForegroundColor Red
    }
}

$localhostFailures = @($results | Where-Object {
    $_.Url -match "http://localhost:" -and -not $_.Ok
})

$ipSuccesses = @($results | Where-Object {
    $_.Url -match ("http://{0}:" -f [regex]::Escape($primaryIp)) -and $_.Ok
})

Write-Section "Diagnosis"
if ($localhostFailures.Count -gt 0 -and $ipSuccesses.Count -gt 0) {
    Write-Host "Localhost is failing while machine IP succeeds for at least one port." -ForegroundColor Yellow
    Write-Host "Most likely cause: loopback listener conflict (often Aspire dcp.exe)." -ForegroundColor Yellow
    Write-Host "Action: stop AppHost/Aspire session or rerun this script with -KillDcpConflicts." -ForegroundColor Yellow
}
elseif ($localhostFailures.Count -eq 0) {
    Write-Host "No localhost endpoint failures detected." -ForegroundColor Green
}
else {
    Write-Host "Failures are not limited to localhost. Check service startup logs and dependencies." -ForegroundColor Yellow
}

$portsWithNoListeners = @($Ports | Where-Object {
    $candidatePort = $_
    (@($listenerRows | Where-Object { $_.Port -eq $candidatePort })).Count -eq 0
})

if ($portsWithNoListeners.Count -gt 0) {
    Write-Host ("No listener detected on: {0}" -f ($portsWithNoListeners -join ", ")) -ForegroundColor Yellow
    Write-Host "This can indicate service not started or startup failure." -ForegroundColor Yellow
}

$failedCritical = @($results | Where-Object {
    $_.Url -match "http://localhost:" -and
    ($_.Url -like "*/health" -or $_.Url -like "*/swagger/index.html") -and
    -not $_.Ok
})

if ($failedCritical.Count -gt 0) {
    exit 1
}

exit 0
