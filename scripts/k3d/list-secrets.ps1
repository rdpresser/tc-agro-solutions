<#
.SYNOPSIS
  List and search secrets in the cluster.

.DESCRIPTION
  Debug tool for viewing secrets across namespaces.

.EXAMPLE
  .\list-secrets.ps1
  .\list-secrets.ps1 argocd
#>

param(
    [string]$Namespace = ""
)

$Color = @{
    Info    = "Cyan"
    Success = "Green"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "=== Listing Secrets ===" -ForegroundColor $Color.Info

if ($Namespace) {
    kubectl get secrets -n $Namespace
}
else {
    Write-Host "All namespaces:" -ForegroundColor $Color.Muted
    kubectl get secrets -A
}

Write-Host ""
