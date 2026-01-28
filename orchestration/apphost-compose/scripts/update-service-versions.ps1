#!/usr/bin/env pwsh
# =====================================================
# Update Docker Compose Service Versions
# =====================================================
# Checks for latest stable versions of all services in docker-compose.yml
# and optionally updates them automatically.
#
# Usage:
#   .\update-service-versions.ps1              # Check only (dry-run)
#   .\update-service-versions.ps1 -Apply       # Apply updates
#   .\update-service-versions.ps1 -Verbose     # Detailed output
# =====================================================

param(
    [switch]$Apply,
    [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# =====================================================
# Configuration
# =====================================================
$ComposeFile = Join-Path $PSScriptRoot "..\docker-compose.yml"
$BackupTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $PSScriptRoot "..\docker-compose.yml.backup.$BackupTimestamp"

# Service definitions with version check strategy
$Services = @(
    @{
        Name           = "TimescaleDB"
        ImagePattern   = "timescale/timescaledb:latest-pg(\d+)"
        CurrentTag     = "latest-pg16"
        Type           = "DockerHub"
        Repo           = "timescale/timescaledb"
        TagFilter      = "latest-pg*"
        UpdateStrategy = "ManualReview"  # PG major version changes need review
    },
    @{
        Name           = "pgAdmin"
        ImagePattern   = "dpage/pgadmin4:latest"
        CurrentTag     = "latest"
        Type           = "DockerHub"
        Repo           = "dpage/pgadmin4"
        TagFilter      = "latest"
        UpdateStrategy = "Latest"
    },
    @{
        Name           = "Redis"
        ImagePattern   = "redis:([\d\.]+)-alpine"
        CurrentTag     = "8.4.0-alpine"
        Type           = "DockerHub"
        Repo           = "library/redis"
        TagFilter      = "*-alpine"
        UpdateStrategy = "MajorVersion"
    },
    @{
        Name           = "RabbitMQ"
        ImagePattern   = "rabbitmq:([\d\.]+)-management-alpine"
        CurrentTag     = "4.2.3-management-alpine"
        Type           = "DockerHub"
        Repo           = "library/rabbitmq"
        TagFilter      = "*-management-alpine"
        UpdateStrategy = "MajorVersion"
    },
    @{
        Name           = "Loki"
        ImagePattern   = "grafana/loki:([\d\.]+)"
        CurrentTag     = "3.6.4"
        Type           = "GitHub"
        Repo           = "grafana/loki"
        UpdateStrategy = "Auto"
    },
    @{
        Name           = "Tempo"
        ImagePattern   = "grafana/tempo:([\d\.]+)"
        CurrentTag     = "2.10.0"
        Type           = "GitHub"
        Repo           = "grafana/tempo"
        UpdateStrategy = "Auto"
    },
    @{
        Name           = "Prometheus"
        ImagePattern   = "prom/prometheus:v([\d\.]+)"
        CurrentTag     = "v3.9.1"
        Type           = "GitHub"
        Repo           = "prometheus/prometheus"
        UpdateStrategy = "Auto"
    },
    @{
        Name           = "OTEL Collector"
        ImagePattern   = "otel/opentelemetry-collector-contrib:([\d\.]+)"
        CurrentTag     = "0.144.0"
        Type           = "GitHub"
        Repo           = "open-telemetry/opentelemetry-collector-releases"
        UpdateStrategy = "Auto"
    },
    @{
        Name           = "Grafana"
        ImagePattern   = "grafana/grafana:([\d\.]+)"
        CurrentTag     = "12.3.1"
        Type           = "GitHub"
        Repo           = "grafana/grafana"
        UpdateStrategy = "Auto"
    }
)

# =====================================================
# Functions
# =====================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Text)
    Write-Host "→ $Text" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Get-GitHubLatestRelease {
    param([string]$Repo)
    
    $maxRetries = 3
    $retryDelaySeconds = 1
    
    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
        try {
            $url = "https://api.github.com/repos/$Repo/releases/latest"
            
            $headers = @{
                "User-Agent" = "PowerShell-VersionChecker/1.0"
                "Accept"     = "application/vnd.github.v3+json"
            }
            
            # Add GitHub token if available (increases rate limit from 60 to 5000 req/hour)
            $ghToken = $env:GITHUB_TOKEN
            if ($ghToken) {
                $headers["Authorization"] = "token $ghToken"
            }
            
            $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 10
            $tagName = $response.tag_name
            
            if ([string]::IsNullOrWhiteSpace($tagName)) {
                Write-Verbose "Empty tag_name for $Repo (attempt $attempt/$maxRetries)"
                if ($attempt -lt $maxRetries) {
                    Start-Sleep -Seconds $retryDelaySeconds
                    $retryDelaySeconds = $retryDelaySeconds * 2
                    continue
                }
                return $null
            }
            
            # Remove leading 'v' if present
            $version = $tagName -replace '^v', ''
            return $version
        }
        catch {
            $errorMsg = $_.Exception.Message
            Write-Verbose "GitHub API error for $Repo (attempt $attempt/$maxRetries): $errorMsg"
            
            if ($attempt -lt $maxRetries) {
                Start-Sleep -Seconds $retryDelaySeconds
                $retryDelaySeconds = $retryDelaySeconds * 2
            }
        }
    }
    
    Write-Verbose "Failed to get GitHub release for $Repo after $maxRetries attempts"
    return $null
}

function Get-DockerHubLatestTag {
    param(
        [string]$Repo,
        [string]$TagFilter
    )
    
    try {
        # Docker Hub API v2
        $url = "https://hub.docker.com/v2/repositories/$Repo/tags?page_size=100"
        $response = Invoke-RestMethod -Uri $url
        
        # Filter and sort tags
        $tags = $response.results | Where-Object { 
            $_.name -like $TagFilter -and 
            $_.name -notlike "*beta*" -and 
            $_.name -notlike "*rc*" -and
            $_.name -notlike "*alpha*"
        } | Sort-Object -Property @{Expression = { $_.last_updated }; Descending = $true }
        
        if ($tags.Count -gt 0) {
            return $tags[0].name
        }
        
        return $null
    }
    catch {
        Write-Verbose "Failed to get Docker Hub tag for $Repo`: $($_.Exception.Message)"
        return $null
    }
}

function Compare-Versions {
    param(
        [string]$Current,
        [string]$Latest,
        [string]$ServiceName = ""
    )
    
    # If identical, up to date
    if ($Current -eq $Latest) { return "UpToDate" }
    
    # Special handling for TimescaleDB (latest-pg16 vs latest-pg17)
    if ($ServiceName -eq "TimescaleDB") {
        if ($Current -match 'latest-pg(\d+)' -and $Latest -match 'latest-pg(\d+)') {
            $currentMatch = [regex]::Match($Current, 'latest-pg(\d+)')
            $latestMatch = [regex]::Match($Latest, 'latest-pg(\d+)')
            if ($currentMatch.Success -and $latestMatch.Success) {
                $currentPg = [int]$currentMatch.Groups[1].Value
                $latestPg = [int]$latestMatch.Groups[1].Value
                if ($latestPg -gt $currentPg) { return "Outdated" }
                if ($latestPg -lt $currentPg) { return "Ahead" }
                return "UpToDate"
            }
        }
    }
    
    # Simple version comparison (semantic versioning)
    try {
        $currentParts = $Current -split '\.' | ForEach-Object { [int]$_ }
        $latestParts = $Latest -split '\.' | ForEach-Object { [int]$_ }
        
        for ($i = 0; $i -lt [Math]::Max($currentParts.Count, $latestParts.Count); $i++) {
            $c = if ($i -lt $currentParts.Count) { $currentParts[$i] } else { 0 }
            $l = if ($i -lt $latestParts.Count) { $latestParts[$i] } else { 0 }
            
            if ($l -gt $c) { return "Outdated" }
            if ($l -lt $c) { return "Ahead" }
        }
        
        return "UpToDate"
    }
    catch {
        # Fallback to string comparison
        if ($Current -eq $Latest) { return "UpToDate" }
        return "Unknown"
    }
}

function Get-LatestVersion {
    param($Service)
    
    if ($Service.Type -eq "GitHub") {
        $version = Get-GitHubLatestRelease -Repo $Service.Repo
        return $version
    }
    elseif ($Service.Type -eq "DockerHub") {
        return Get-DockerHubLatestTag -Repo $Service.Repo -TagFilter $Service.TagFilter
    }
    
    return $null
}

function Get-CurrentTagFromCompose {
    param([string]$ImagePattern)
    
    try {
        $content = Get-Content $ComposeFile -Raw
        
        # Extract the repository from the image pattern (e.g., "timescale/timescaledb" from "timescale/timescaledb:latest-pg(\d+)")
        $repo = $ImagePattern -replace ':.*$', ''
        
        # Find the line with this repository
        if ($content -match "image:\s+$([regex]::Escape($repo)):([^\s]+)") {
            return $matches[1]
        }
    }
    catch {
        Write-Verbose "Error reading current tag from compose file: $($_.Exception.Message)"
    }
    
    return $null
}

function Update-ComposeFile {
    param(
        [string]$FilePath,
        [string]$ImagePattern,
        [string]$NewTag
    )
    
    $content = Get-Content $FilePath -Raw
    $pattern = "image:\s+$ImagePattern"
    
    # Extract the image base (e.g., "grafana/loki")
    $imageBase = $ImagePattern -replace ':.*$', ''
    
    # Replace the version
    $newImage = "${imageBase}:${NewTag}"
    $updatedContent = $content -replace $pattern, "image: $newImage"
    
    if ($updatedContent -ne $content) {
        Set-Content -Path $FilePath -Value $updatedContent -NoNewline
        return $true
    }
    
    return $false
}

# =====================================================
# Main Script
# =====================================================

Write-Header "Docker Compose Version Checker"

# Check if compose file exists
if (-not (Test-Path $ComposeFile)) {
    Write-Error "docker-compose.yml not found at: $ComposeFile"
    exit 1
}

Write-Step "Scanning docker-compose.yml..."
Write-Host ""

# Show GitHub token status
if ($env:GITHUB_TOKEN) {
    Write-Host "ℹ GitHub token detected (rate limit: 5000 req/hour)" -ForegroundColor Cyan
}
else {
    Write-Host "ℹ No GitHub token found (rate limit: 60 req/hour). To increase: set \$env:GITHUB_TOKEN" -ForegroundColor Yellow
}

Write-Host ""

# Results tracking
$results = @()
$updatesAvailable = $false

# Check each service
foreach ($service in $Services) {
    Write-Host "Checking $($service.Name)..." -NoNewline
    
    # Read current tag from docker-compose.yml (dynamic)
    $currentTag = Get-CurrentTagFromCompose -ImagePattern $service.ImagePattern
    if ($null -eq $currentTag) {
        $currentTag = $service.CurrentTag  # Fallback to default if not found
    }
    
    $latest = Get-LatestVersion -Service $service
    
    if ($null -eq $latest) {
        Write-Host " [SKIP - API Error]" -ForegroundColor Gray
        
        # Still add to results for visibility
        $result = [PSCustomObject]@{
            Service      = $service.Name
            Current      = $currentTag
            Latest       = "N/A (API Error)"
            Status       = "Unknown"
            Strategy     = $service.UpdateStrategy
            ImagePattern = $service.ImagePattern
        }
        
        $results += $result
        continue
    }
    
    # Normalize versions for comparison
    $currentVersion = $currentTag -replace '^v', '' -replace '-.*$', ''
    $latestVersion = $latest -replace '^v', '' -replace '-.*$', ''
    
    $status = Compare-Versions -Current $currentVersion -Latest $latestVersion -ServiceName $service.Name
    
    $result = [PSCustomObject]@{
        Service      = $service.Name
        Current      = $currentTag
        Latest       = $latest
        Status       = $status
        Strategy     = $service.UpdateStrategy
        ImagePattern = $service.ImagePattern
    }
    
    $results += $result
    
    switch ($status) {
        "UpToDate" {
            Write-Host " ✓ Up to date ($currentTag)" -ForegroundColor Green
        }
        "Outdated" {
            Write-Host " ⚠ Update available: $currentTag → $latest" -ForegroundColor Yellow
            $updatesAvailable = $true
        }
        "Ahead" {
            Write-Host " ℹ Using newer version ($currentTag > $latest)" -ForegroundColor Cyan
        }
        default {
            Write-Host " ? Unable to compare versions" -ForegroundColor Gray
        }
    }
}

# =====================================================
# Summary Table
# =====================================================

Write-Host ""
Write-Header "Summary"

$results | Format-Table -Property @(
    @{Label = "Service"; Expression = { $_.Service }; Width = 20 },
    @{Label = "Current"; Expression = { $_.Current }; Width = 20 },
    @{Label = "Latest"; Expression = { $_.Latest }; Width = 20 },
    @{Label = "Status"; Expression = {
            switch ($_.Status) {
                "UpToDate" { "✓ Up to date" }
                "Outdated" { "⚠ Outdated" }
                "Ahead" { "→ Ahead" }
                default { "? Unknown" }
            }
        }; Width = 15
    },
    @{Label = "Strategy"; Expression = { $_.Strategy }; Width = 15 }
) -AutoSize

# =====================================================
# Apply Updates
# =====================================================

if ($updatesAvailable) {
    Write-Host ""
    
    if ($Apply) {
        Write-Header "Applying Updates"
        
        # Create backup
        if (-not $SkipBackup) {
            Write-Step "Creating backup..."
            Copy-Item $ComposeFile $BackupFile -Force
            Write-Success "Backup created: docker-compose.yml.backup.$BackupTimestamp"
        }
        
        $updatedCount = 0
        
        foreach ($result in $results | Where-Object { $_.Status -eq "Outdated" }) {
            if ($result.Strategy -eq "ManualReview") {
                Write-Warning "Skipping $($result.Service) - requires manual review (breaking changes possible)"
                continue
            }
            
            Write-Step "Updating $($result.Service): $($result.Current) → $($result.Latest)..."
            
            # Extract image base and build new tag
            $imageBase = $result.ImagePattern -replace ':.*$', ''
            $updated = Update-ComposeFile -FilePath $ComposeFile -ImagePattern $result.ImagePattern -NewTag $result.Latest
            
            if ($updated) {
                Write-Success "Updated $($result.Service)"
                $updatedCount++
            }
            else {
                Write-Warning "Failed to update $($result.Service) - pattern may need adjustment"
            }
        }
        
        Write-Host ""
        Write-Success "Updated $updatedCount service(s)"
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Review changes: git diff docker-compose.yml"
        Write-Host "  2. Pull new images: docker compose pull"
        Write-Host "  3. Restart services: docker compose up -d"
        Write-Host "  4. Test thoroughly before committing"
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Warning "Updates available! Run with -Apply to update docker-compose.yml"
        Write-Host ""
        Write-Host "Command:" -ForegroundColor Cyan
        Write-Host "  .\update-service-versions.ps1 -Apply"
        Write-Host ""
    }
}
else {
    Write-Host ""
    Write-Success "All services are up to date! 🎉"
    Write-Host ""
}

# =====================================================
# Exit
# =====================================================

if ($updatesAvailable -and -not $Apply) {
    exit 1  # Signal updates available
}

exit 0
