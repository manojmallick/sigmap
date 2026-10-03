# PowerShell fixture for SigMap extractor testing

<#
Outer comment block <# nested block comment #> still in outer comment
#>
$hereString = @"
function Ignored-InHereString { }
"@

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
        return ($this.BasePath + '.' + $format)
    }

    static [void] ResetConfiguration() {
        throw ("cannot reset")
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

# Unexported function: should be omitted because Export-ModuleMember is present below
function Get-InternalState {
    return $script:cachedResult
}

Export-ModuleMember -Function Get-UserReport, Invoke-QuickCheck, Select-HealthyHost, Deploy-StackWorkflow -Alias gur

# Constructs that should NOT be extracted:
$global:config = @{ Key = 'Value' }
$script:counter = 100
Write-Host "Top-level script invocation"
. ./lib/shared.ps1
