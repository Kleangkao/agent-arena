param(
    [ValidateSet('Provision','Check','Fund','Settle','SquadDeploy','SquadPublish','CommanderRegister','CommanderMatch','CommanderPublish')][string]$Mode = 'Check',
    [string]$RegistryAddress,
    [switch]$ConfirmSquadWrite,
    [switch]$ConfirmCommanderRegistration,
    [switch]$ConfirmCommanderMatch,
    [switch]$ConfirmCommanderPublication,
    [switch]$CorrectiveCoaching,
    [switch]$RebroadcastKnown
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$repo = Split-Path -Parent $PSScriptRoot
$vault = Join-Path $repo '.arena-data/testnet-signers.dpapi'

Push-Location $repo
try {
    if ($Mode -in @('SquadDeploy','SquadPublish') -and !$ConfirmSquadWrite) {
        throw 'Confirm owner approval for the separate BSC Testnet squad write.'
    }
    if ($Mode -eq 'CommanderRegister' -and !$ConfirmCommanderRegistration) {
        throw 'Confirm owner approval for one ERC-8004 commander registration on BSC Testnet.'
    }
    if ($Mode -eq 'CommanderMatch' -and !$ConfirmCommanderMatch) {
        throw 'Confirm one live match using an off-chain Testnet owner signature.'
    }
    if ($Mode -eq 'CommanderPublish' -and !$ConfirmCommanderPublication) {
        throw 'Confirm owner approval for this exact identity evidence commitment on BSC Testnet.'
    }
    if ($Mode -eq 'SquadPublish' -and $RegistryAddress -notmatch '^0x[0-9a-fA-F]{40}$') {
        throw 'Provide the approved squad registry address.'
    }
    if ($Mode -eq 'Provision' -and -not (Test-Path -LiteralPath $vault)) {
        git check-ignore --quiet -- .arena-data/testnet-signers.dpapi
        if ($LASTEXITCODE -ne 0) { throw 'Testnet signer storage must be excluded from Git.' }
        $null = New-Item -ItemType Directory -Path (Split-Path -Parent $vault) -Force
        $generated = 'import {generatePrivateKey} from "viem/accounts"; process.stdout.write(JSON.stringify([generatePrivateKey(),generatePrivateKey()]));' | node --input-type=module
        if ($LASTEXITCODE -ne 0 -or !$generated) { throw 'Testnet signer generation failed.' }
        $protected = ConvertTo-SecureString $generated -AsPlainText -Force | ConvertFrom-SecureString
        $stream = [IO.File]::Open($vault,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes($protected)
            $stream.Write($bytes,0,$bytes.Length)
        } finally { $stream.Dispose() }
        Remove-Variable generated
    }
    if (!(Test-Path -LiteralPath $vault)) { throw 'Encrypted Testnet signers are missing.' }
    $credential = ConvertTo-SecureString ([IO.File]::ReadAllText($vault))
    $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential)
    try { $keys = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer) | ConvertFrom-Json }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer) }
    if ($Mode -in @('SquadDeploy','SquadPublish','CommanderRegister','CommanderMatch','CommanderPublish')) { $env:BSC_TESTNET_OPERATOR_KEY = $keys[0] }
    else { $env:BSC_TESTNET_OPERATOR_KEY,$env:BSC_TESTNET_PLAYER_KEY = $keys }
    Remove-Variable keys
    if ($Mode -eq 'CommanderPublish') {
        $command = @('scripts/squad-registry.ts','testnet','publish-identity','0xbd1a8427da0b2b2d947a391ed117e49ec8801f81','0xadd6160b9499c74448219c3b1b1bd332cb4f51f70b156e991dc7414cb1d2a9f0','--confirm-testnet-write')
        if ($RebroadcastKnown) { $command += '--rebroadcast-known' }
        & .\node_modules\.bin\tsx.cmd @command
        if ($LASTEXITCODE -ne 0) { throw 'Commander publication interrupted. Check the existing transaction journal before retrying.' }
    } elseif ($Mode -eq 'CommanderMatch') {
        $command = @('scripts/identity-match-demo.ts','--confirm-live-identity-match')
        if ($CorrectiveCoaching) { $command += '--corrective' }
        & .\node_modules\.bin\tsx.cmd @command
        if ($LASTEXITCODE -ne 0) { throw 'Commander demo did not complete. Check the saved match evidence.' }
    } elseif ($Mode -eq 'CommanderRegister') {
        & .\node_modules\.bin\tsx.cmd scripts/register-testnet-commander.ts --confirm-erc8004-testnet-registration
        if ($LASTEXITCODE -ne 0) { throw 'Registration interrupted. Check the transaction journal before retrying.' }
    } elseif ($Mode -in @('SquadDeploy','SquadPublish')) {
        $command = @('scripts/squad-registry.ts','testnet')
        if ($Mode -eq 'SquadDeploy') { $command += 'deploy' }
        else { $command += @('publish',$RegistryAddress) }
        $command += '--confirm-testnet-write'
        if ($RebroadcastKnown) { $command += '--rebroadcast-known' }
        & .\node_modules\.bin\tsx.cmd @command
        if ($LASTEXITCODE -ne 0) { throw 'Squad registry workflow interrupted. Check the transaction journal before retrying.' }
    } elseif ($Mode -eq 'Settle') {
        & .\node_modules\.bin\tsx.cmd scripts/settle-testnet.ts
        if ($LASTEXITCODE -ne 0) { throw 'Testnet workflow interrupted. Check the transaction journal before retrying.' }
    } else {
        if ($Mode -eq 'Fund') { node scripts/testnet-balances.mjs --fund }
        else { node scripts/testnet-balances.mjs }
        if ($LASTEXITCODE -ne 0) { throw 'Testnet balance check failed.' }
    }
} finally {
    Remove-Item Env:BSC_TESTNET_OPERATOR_KEY,Env:BSC_TESTNET_PLAYER_KEY -ErrorAction SilentlyContinue
    Pop-Location
}
