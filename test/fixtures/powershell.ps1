# PowerShell fixture for SigMap extractor testing

enum Severity {
    Low
    Medium
    High
}

class ReportService {
    [string]$BasePath

    ReportService([string]$path) {
        $this.BasePath = $path
    }

    [string] GenerateReport([string]$format = 'json') {
        return "report.$format"
    }

    static [void] ResetConfiguration() {
    }

    hidden [void] LogInternal([string]$msg) {
    }
}

<#
.SYNOPSIS
Builds a user activity report from audit logs.
.DESCRIPTION
Long description here.
#>
function Get-UserReport {
    [CmdletBinding()]
    [OutputType([PSCustomObject])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(ValueFromPipeline = $true)]
        [int]$RetryCount = (Get-Random -Minimum 1 -Maximum 5),

        [string[]]$Tags = @('prod', 'audit')
    )

    Write-Host "Generating user report from $Path"
    $script:cachedResult = $true
}

function Invoke-QuickCheck($Target, [int]$Timeout = 30) {
    return $true
}

filter Select-HealthyHost {
    param([bool]$Strict = $false)
    if ($_.Health -eq 'Good') { $_ }
}

workflow Deploy-StackWorkflow {
    param([string]$ClusterName)
    Parallel {
        InlineScript { Write-Output "Deploying to $ClusterName" }
    }
}

# Constructs that should NOT be extracted:
$global:config = @{ Key = 'Value' }
$script:counter = 100
Write-Host "Top-level script invocation"
. ./lib/shared.ps1
