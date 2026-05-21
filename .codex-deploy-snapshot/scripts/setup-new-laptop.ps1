param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Test-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Resolve-ToolPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandName,
        [string[]]$CandidatePaths = @()
    )

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    foreach ($candidate in $CandidatePaths) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Step "Checking required tools"

$gitPath = Resolve-ToolPath -CommandName "git" -CandidatePaths @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe"
)
$nodePath = Resolve-ToolPath -CommandName "node" -CandidatePaths @(
    "C:\Program Files\nodejs\node.exe"
)
$npmPath = Resolve-ToolPath -CommandName "npm" -CandidatePaths @(
    "C:\Program Files\nodejs\npm.cmd"
)

$missing = @()
if (-not $gitPath) {
    $missing += "Git"
}
if (-not $nodePath) {
    $missing += "Node.js 20+"
}
if (-not $npmPath) {
    $missing += "npm"
}

if ($missing.Count -gt 0) {
    Write-Host "Missing prerequisites:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Install the missing tools, reopen PowerShell, and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Git, Node, and npm are available." -ForegroundColor Green
Write-Host "Git:  $gitPath" -ForegroundColor DarkGray
Write-Host "Node: $nodePath" -ForegroundColor DarkGray
Write-Host "npm:  $npmPath" -ForegroundColor DarkGray

Write-Step "Checking project files"

if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Write-Host ".env.local is missing." -ForegroundColor Yellow
        Write-Host "Copy .env.example to .env.local and fill in your real keys before running the app." -ForegroundColor Yellow
    } else {
        Write-Host ".env.local is missing and no .env.example was found." -ForegroundColor Yellow
    }
} else {
    Write-Host ".env.local is present." -ForegroundColor Green
}

if (-not $SkipInstall) {
    Write-Step "Installing npm dependencies"
    & $npmPath install
} else {
    Write-Step "Skipping npm install"
}

Write-Step "Next steps"
Write-Host "1. If this repo uses new Supabase migrations, run: supabase link --project-ref <ref>" -ForegroundColor White
Write-Host "2. Then run: npm run db:push" -ForegroundColor White
Write-Host "3. Start the app with: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "New laptop bootstrap complete." -ForegroundColor Green
