param(
    [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'API KEY.txt'),
    [switch]$SaveLocal
)

$ErrorActionPreference = 'Stop'
$lines = @(Get-Content -LiteralPath $CredentialPath | ForEach-Object {$_.Trim()} |
    Where-Object {$_} | Select-Object -Unique)
if (!$lines.Count) { throw 'The credential file has no nonempty entries.' }
$credential = $lines[0].Trim('"').Trim("'")
if (!$credential) { throw 'The selected credential is empty.' }
try {
    $response = Invoke-RestMethod -Uri 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite' `
        -Headers @{'x-goog-api-key' = $credential} -TimeoutSec 15
} catch {
    if ($_.Exception.Response) {
        throw ('Gemini metadata request failed with HTTP ' + [int]$_.Exception.Response.StatusCode)
    }
    throw 'Gemini metadata request failed before receiving an HTTP response.'
}

$supported = $response.supportedGenerationMethods -contains 'generateContent'
if ($SaveLocal -and $supported) {
    $ignored = Join-Path $PSScriptRoot '../.arena-data'
    New-Item -ItemType Directory -Force -Path $ignored | Out-Null
    ConvertTo-SecureString $credential -AsPlainText -Force | ConvertFrom-SecureString |
        Set-Content -LiteralPath (Join-Path $ignored 'gemini-v2.dpapi')
}
[pscustomobject]@{
    CredentialEntries = $lines.Count
    SelectedModel = $response.name
    GenerationSupported = $supported
    GenerationRequests = 0
    SavedWindowsCurrentUserEncrypted = [bool]($SaveLocal -and $supported)
}
