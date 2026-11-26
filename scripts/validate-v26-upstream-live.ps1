param(
    [ValidateSet('Probe','Duel','Prepare')]
    [string]$Mode = 'Prepare'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$directory = Join-Path $repo '.arena-data/v26-upstream'
$vault = Join-Path $directory 'operator-token.dpapi'
if ($Mode -eq 'Prepare') {
    if (!(Test-Path -LiteralPath $vault)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
        $bytes = New-Object byte[] 32
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $random.GetBytes($bytes)
            ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force |
                ConvertFrom-SecureString | Set-Content -LiteralPath $vault
        } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
            $random.Dispose()
        }
    }
    Write-Output 'Protected local operator token is ready. No model or storage requests were made.'
    exit 0
}

$prior = $env:ARENA_V26_VALIDATION_TOKEN
$pointer = [IntPtr]::Zero
try {
    if (!$prior) {
        $protected = Get-Content -Raw -LiteralPath $vault
        $secure = ConvertTo-SecureString ($protected.Trim())
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $env:ARENA_V26_VALIDATION_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    Push-Location -LiteralPath $repo
    try {
        npm exec --offline -- tsx scripts/validate-v26-upstream-live.ts $Mode.ToLowerInvariant() --live
        $code = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    $env:ARENA_V26_VALIDATION_TOKEN = $prior
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
exit $code
