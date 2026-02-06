function Get-ExcludedPortRanges {
    $ranges = @()
    try {
        $output = netsh interface ipv4 show excludedportrange protocol=tcp 2>$null
        foreach ($line in $output) {
            if ($line -match "^\s*(\d+)\s+(\d+)\s*$") {
                $ranges += [pscustomobject]@{ Start = [int]$matches[1]; End = [int]$matches[2] }
            }
        }
    }
    catch {
        # If netsh is unavailable, return empty list and rely on port-in-use check.
    }
    return $ranges
}

function Test-PortInUse {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conn)
    }
    catch {
        return $false
    }
}

function Test-PortExcluded {
    param(
        [int]$Port,
        [array]$Ranges
    )
    foreach ($r in $Ranges) {
        if ($Port -ge $r.Start -and $Port -le $r.End) { return $true }
    }
    return $false
}

function Select-K3dApiPort {
    $preferred = @(6443, 16443, 26443)
    $ranges = Get-ExcludedPortRanges

    foreach ($p in $preferred) {
        if (-not (Test-PortInUse -Port $p) -and -not (Test-PortExcluded -Port $p -Ranges $ranges)) {
            return "$p"
        }
    }

    for ($p = 55000; $p -le 55100; $p++) {
        if (-not (Test-PortInUse -Port $p) -and -not (Test-PortExcluded -Port $p -Ranges $ranges)) {
            return "$p"
        }
    }

    return "6443"
}

function Get-K3dApiPortFromCluster {
    param([string]$ClusterName)
    try {
        $clusters = k3d cluster list -o json 2>$null | ConvertFrom-Json
        $cluster = $clusters | Where-Object { $_.name -eq $ClusterName } | Select-Object -First 1
        if (-not $cluster) { return $null }

        $lb = $cluster.nodes | Where-Object { $_.role -eq "loadbalancer" } | Select-Object -First 1
        if ($lb -and $lb.portMappings -and $lb.portMappings."6443/tcp") {
            return [int]$lb.portMappings."6443/tcp"[0].HostPort
        }

        $server = $cluster.nodes | Where-Object { $_.role -eq "server" } | Select-Object -First 1
        if ($server -and $server.serverOpts -and $server.serverOpts.kubeAPI -and $server.serverOpts.kubeAPI.Binding) {
            $port = $server.serverOpts.kubeAPI.Binding.HostPort
            if ($port) { return [int]$port }
        }
    }
    catch {
        return $null
    }

    return $null
}

function Test-K3dApiPortHealth {
    param([string]$ClusterName)

    $port = Get-K3dApiPortFromCluster -ClusterName $ClusterName
    if (-not $port) {
        return [pscustomobject]@{
            Port       = $null
            IsExcluded = $false
            IsInUse    = $false
        }
    }

    $ranges = Get-ExcludedPortRanges
    $isExcluded = Test-PortExcluded -Port $port -Ranges $ranges
    $isInUse = Test-PortInUse -Port $port

    return [pscustomobject]@{
        Port       = $port
        IsExcluded = $isExcluded
        IsInUse    = $isInUse
    }
}