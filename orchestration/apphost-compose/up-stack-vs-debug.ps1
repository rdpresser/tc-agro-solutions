#Requires -Version 7
<#
.SYNOPSIS
    Bring up the full VS Code debug stack (all services) with build and recreate.
    Works on Linux, macOS, and Windows (PowerShell 7+).
#>
Set-StrictMode -Version Latest

# Handle APPDATA cross-platform (docker compose uses it on Windows)
if ($IsLinux -or $IsMacOS) {
    $env:APPDATA = "$env:HOME/.config"
}

$dir = $PSScriptRoot

$composeFiles = @(
    '-f', "$dir/docker-compose.yml",
    '-f', "$dir/docker-compose.override.yml"
)

$genFile = "$dir/obj/Docker/docker-compose.vs.debug.g.yml"
$partialFile = "$dir/obj/Docker/docker-compose.vs.debug.partial.g.yml"

if (Test-Path $genFile) {
    $composeFiles += @('-f', $genFile)
}
elseif (-not $IsLinux -and (Test-Path $partialFile)) {
    $composeFiles += @('-f', $partialFile)
}

$composeFiles += @('-f', "$dir/docker-compose.vs.debug.yml")

function Invoke-WithRetry {
    param(
        [int]$MaxAttempts,
        [scriptblock]$ScriptBlock
    )
    $attempt = 1
    while ($true) {
        & $ScriptBlock
        if ($LASTEXITCODE -eq 0) { return }
        if ($attempt -ge $MaxAttempts) {
            Write-Error "All $MaxAttempts attempts failed (last exit code: $LASTEXITCODE)"
            exit $LASTEXITCODE
        }
        $attempt++
        Write-Host "Retry $attempt/$MaxAttempts in 5s..."
        Start-Sleep -Seconds 5
    }
}

Write-Host '==> Pre-pulling base images from MCR...'
Invoke-WithRetry -MaxAttempts 8 { & docker pull mcr.microsoft.com/dotnet/aspnet:10.0 }
Invoke-WithRetry -MaxAttempts 8 { & docker pull mcr.microsoft.com/dotnet/sdk:10.0 }

Write-Host '==> Bringing up full stack (build/recreate as needed)...'
$env:COMPOSE_PARALLEL_LIMIT = '1'
$upArgs = @('compose') + $composeFiles + @(
    '--project-name', 'tc-agro-vscode-debug',
    '--ansi', 'never',
    'up', '-d', '--build', '--remove-orphans', '--force-recreate'
)
Invoke-WithRetry -MaxAttempts 6 { & docker @upArgs }
