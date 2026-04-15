[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$script:ScriptName = Split-Path -Leaf $MyInvocation.MyCommand.Path

function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" }
function Write-Ok { param([string]$Message) Write-Host "[OK]   $Message" }

function Stop-Script {
    param(
        [string]$Message,
        [int]$Code = 1
    )

    Write-Error $Message
    exit $Code
}

trap {
    $line = $_.InvocationInfo.ScriptLineNumber
    $text = $_.Exception.Message
    Write-Error ("[{0}] failed at line {1}: {2}" -f $script:ScriptName, $line, $text)
    exit 1
}

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)

    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Test-CommandAvailable -Name $Name)) {
        Stop-Script "Required command '$Name' is not available."
    }
}

function Test-DnfPackageAvailable {
    param([Parameter(Mandatory = $true)][string]$Package)

    & dnf repoquery --quiet $Package *> $null
    return $LASTEXITCODE -eq 0
}

function Test-DnfPackageInstalled {
    param([Parameter(Mandatory = $true)][string]$Package)

    & dnf repoquery --installed --quiet --whatprovides $Package *> $null
    return $LASTEXITCODE -eq 0
}

function Install-DnfPackages {
    param([Parameter(Mandatory = $true)][string[]]$Packages)

    $toInstall = New-Object System.Collections.Generic.List[string]

    foreach ($package in $Packages) {
        if (Test-DnfPackageInstalled -Package $package) {
            Write-Ok "Package already installed: $package"
            continue
        }

        if (Test-DnfPackageAvailable -Package $package) {
            $toInstall.Add($package)
            continue
        }

        Write-Warn "Package not available in enabled repositories: $package"
    }

    if ($toInstall.Count -eq 0) {
        Write-Ok "No additional dnf packages required"
        return
    }

    Write-Info ("Installing packages via dnf: {0}" -f ($toInstall -join " "))
    & sudo dnf install -y @toInstall
    if ($LASTEXITCODE -ne 0) {
        Stop-Script "dnf install failed for packages: $($toInstall -join ', ')" $LASTEXITCODE
    }
}

function Install-BinaryFile {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $tempFile = [System.IO.Path]::GetTempFileName()

    try {
        Write-Info "Installing $Name"
        & curl -fsSL $Url -o $tempFile
        if ($LASTEXITCODE -ne 0) {
            Stop-Script "Failed to download $Name from $Url" $LASTEXITCODE
        }

        & sudo install -m 0755 $tempFile $Destination
        if ($LASTEXITCODE -ne 0) {
            Stop-Script "Failed to install $Name to $Destination" $LASTEXITCODE
        }
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Install-HelmBinary {
    $version = "v3.18.0"
    $archive = "helm-$version-linux-amd64.tar.gz"
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("helm-install-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        Write-Info "Installing helm $version"
        $archivePath = Join-Path $tempDir $archive
        & curl -fsSL "https://get.helm.sh/$archive" -o $archivePath
        if ($LASTEXITCODE -ne 0) {
            Stop-Script "Failed to download helm archive" $LASTEXITCODE
        }

        & tar -xzf $archivePath -C $tempDir
        if ($LASTEXITCODE -ne 0) {
            Stop-Script "Failed to extract helm archive" $LASTEXITCODE
        }

        $helmBinary = Join-Path $tempDir "linux-amd64" "helm"
        & sudo install -m 0755 $helmBinary "/usr/local/bin/helm"
        if ($LASTEXITCODE -ne 0) {
            Stop-Script "Failed to install helm binary" $LASTEXITCODE
        }
    }
    finally {
        if (Test-Path $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Add-ExportLine {
    param(
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(Mandatory = $true)][string]$Line
    )

    if (-not (Test-Path -LiteralPath $File)) {
        New-Item -ItemType File -Path $File -Force | Out-Null
    }

    $existing = Get-Content -LiteralPath $File -ErrorAction SilentlyContinue
    if ($existing -contains $Line) {
        Write-Ok "DOCKER_HOST export already present in $File"
        return
    }

    Add-Content -LiteralPath $File -Value $Line
    Write-Ok "Added DOCKER_HOST export to $File"
}

if (-not $IsLinux) {
    Stop-Script "${script:ScriptName} supports Fedora Linux only."
}

$osRelease = @{}
if (Test-Path -LiteralPath "/etc/os-release") {
    Get-Content -LiteralPath "/etc/os-release" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $Matches[1]
            $value = $Matches[2].Trim('"')
            $osRelease[$key] = $value
        }
    }
}

if ($osRelease.ContainsKey("ID") -and $osRelease["ID"] -ne "fedora") {
    Stop-Script "${script:ScriptName} supports Fedora only. Detected '$($osRelease["ID"])'."
}

if ([int](id -u) -eq 0) {
    Write-Warn "Running as root is not recommended. Run as your regular user."
}

Assert-Command -Name sudo
Assert-Command -Name dnf
Assert-Command -Name systemctl
Assert-Command -Name curl
Assert-Command -Name tar

$basePackages = @(
    "podman",
    "podman-docker",
    "kubernetes-client",
    "jq",
    "wget",
    "unzip",
    "git"
)

Install-DnfPackages -Packages $basePackages

$dockerComposeAvailable = $false
& docker compose version *> $null
if ($LASTEXITCODE -eq 0) {
    $dockerComposeAvailable = $true
    Write-Ok "docker compose already available"
}

if (-not $dockerComposeAvailable) {
    foreach ($composePkg in @("docker-compose-plugin", "docker-compose", "docker-compose-switch", "podman-compose")) {
        if (Test-DnfPackageAvailable -Package $composePkg) {
            Install-DnfPackages -Packages @($composePkg)
            $dockerComposeAvailable = $true
            break
        }
    }
}

if (-not $dockerComposeAvailable) {
    Write-Warn "Could not install any docker compose compatible package via dnf"
}

& helm version *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Ok "helm already installed"
}
elseif (Test-DnfPackageAvailable -Package "helm") {
    Install-DnfPackages -Packages @("helm")
}
else {
    Install-HelmBinary
}

if (-not (Test-CommandAvailable -Name yq)) {
    Install-BinaryFile -Name "yq" -Url "https://github.com/mikefarah/yq/releases/download/v4.44.3/yq_linux_amd64" -Destination "/usr/local/bin/yq"
}
else {
    Write-Ok "yq already installed"
}

if (-not (Test-CommandAvailable -Name k3d)) {
    Write-Info "Installing k3d"
    & bash -lc "curl -fsSL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"
    if ($LASTEXITCODE -ne 0) {
        Stop-Script "Failed to install k3d" $LASTEXITCODE
    }
}
else {
    Write-Ok "k3d already installed"
}

if (-not (Test-CommandAvailable -Name argocd)) {
    Install-BinaryFile -Name "argocd" -Url "https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64" -Destination "/usr/local/bin/argocd"
}
else {
    Write-Ok "argocd already installed"
}

if (-not (Test-CommandAvailable -Name pwsh)) {
    Write-Warn "PowerShell is not installed. Some project scripts use .ps1 files."
    Write-Warn "Install manually if needed: sudo dnf install -y powershell"
}

Write-Info "Enabling Podman user socket (Docker-compatible endpoint)"
& systemctl --user enable --now podman.socket
if ($LASTEXITCODE -ne 0) {
    Stop-Script "Failed to enable podman.socket" $LASTEXITCODE
}

$socketPath = "unix:///run/user/$([int](id -u))/podman/podman.sock"
$line = "export DOCKER_HOST=$socketPath"

Add-ExportLine -File (Join-Path $HOME ".zshrc") -Line $line
Add-ExportLine -File (Join-Path $HOME ".bashrc") -Line $line

$env:DOCKER_HOST = $socketPath

& sudo test -f "/etc/containers/nodocker"
if ($LASTEXITCODE -ne 0) {
    Write-Info "Creating /etc/containers/nodocker to silence podman Docker emulation banner"
    & sudo tee "/etc/containers/nodocker" *> $null
    if ($LASTEXITCODE -ne 0) {
        Stop-Script "Failed to create /etc/containers/nodocker" $LASTEXITCODE
    }
}
else {
    Write-Ok "/etc/containers/nodocker already exists"
}

Write-Host ""
Write-Info "Validating toolchain"

$checks = @(
    @{ Name = "docker CLI (podman-docker)"; Cmd = { & docker version *> $null } },
    @{ Name = "docker compose"; Cmd = { & docker compose version *> $null } },
    @{ Name = "k3d"; Cmd = { & k3d version *> $null } },
    @{ Name = "kubectl"; Cmd = { & kubectl version --client *> $null } },
    @{ Name = "helm"; Cmd = { & helm version *> $null } },
    @{ Name = "argocd"; Cmd = { & argocd version --client *> $null } },
    @{ Name = "yq"; Cmd = { & yq --version *> $null } },
    @{ Name = "jq"; Cmd = { & jq --version *> $null } }
)

foreach ($check in $checks) {
    & $check.Cmd
    if ($LASTEXITCODE -eq 0) {
        Write-Ok $check.Name
    }
    else {
        Write-Warn "$($check.Name) failed"
    }
}

Write-Host ""
Write-Ok "Fedora CLI bootstrap finished"
Write-Host "Next steps:"
Write-Host "  1) Open a new terminal (or run: export DOCKER_HOST=$socketPath)"
Write-Host "  2) Run project bootstrap: pwsh ./scripts/k3d/bootstrap-lightweight.ps1"
Write-Host "  3) Or full flow: pwsh ./scripts/k3d/bootstrap.ps1"
