param(
    [string]$PythonPath
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$FrontendRoot = Join-Path $ProjectRoot 'frontend'

function Get-PythonVersion([string]$Executable) {
    try {
        $output = & $Executable --version 2>&1
        if ($LASTEXITCODE -ne 0 -or "$output" -notmatch 'Python\s+(\d+\.\d+\.\d+)') {
            return $null
        }
        return [version]$Matches[1]
    }
    catch {
        return $null
    }
}

function Get-PythonCandidates {
    $paths = @()

    if ($PythonPath) {
        if (-not (Test-Path $PythonPath -PathType Leaf)) {
            throw "Python executable not found: $PythonPath"
        }
        $paths += (Resolve-Path $PythonPath).Path
    }

    $venvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
    if (Test-Path $venvPython -PathType Leaf) {
        $paths += $venvPython
    }

    foreach ($commandName in @('python', 'python3')) {
        $command = Get-Command $commandName -ErrorAction SilentlyContinue
        if ($command -and $command.Source) {
            $paths += $command.Source
        }
    }

    if ($env:LOCALAPPDATA) {
        $paths += Get-ChildItem `
            -Path (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python*\python.exe') `
            -File -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName }
    }

    return $paths | Select-Object -Unique
}

Set-Location $ProjectRoot

$requiredData = @(
    'data\processed\integrated_risk_features_v1.parquet',
    'data\processed\account_layer_classification_v1.parquet',
    'data\processed\transaction_edges_with_row_id.parquet'
)
$missingData = @($requiredData | Where-Object { -not (Test-Path (Join-Path $ProjectRoot $_) -PathType Leaf) })
if ($missingData.Count -gt 0) {
    $formattedMissing = $missingData | ForEach-Object { "  - $_" }
    throw "Required project data is missing. Copy these files from the authorized project dataset into this checkout:`n$($formattedMissing -join "`n")`nSee data\README.md."
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
    throw 'Node.js with npm is required. Install Node.js 20.19+ or 22.12+, then open a new PowerShell terminal.'
}

$nodeOutput = & $node.Source --version 2>&1
if ($LASTEXITCODE -ne 0 -or "$nodeOutput" -notmatch 'v?(\d+\.\d+\.\d+)') {
    throw "Could not determine Node.js version: $nodeOutput"
}
$nodeVersion = [version]$Matches[1]
$supportedNode = $nodeVersion -ge [version]'22.12.0' -or
    ($nodeVersion.Major -eq 20 -and $nodeVersion -ge [version]'20.19.0') -or
    $nodeVersion.Major -ge 23
if (-not $supportedNode) {
    throw "Node.js $nodeVersion is not supported. Install Node.js 20.19+ or 22.12+."
}

$validPython = @()
foreach ($candidate in (Get-PythonCandidates)) {
    $version = Get-PythonVersion $candidate
    if ($version -and $version -ge [version]'3.11.0') {
        $validPython += [pscustomobject]@{ Path = $candidate; Version = $version }
    }
}
if ($validPython.Count -eq 0) {
    throw 'Python 3.11 or newer was not found. Install it, reopen PowerShell, or pass its executable path with -PythonPath.'
}
$basePython = $validPython | Sort-Object Version -Descending | Select-Object -First 1

$venvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$venvVersion = if (Test-Path $venvPython -PathType Leaf) { Get-PythonVersion $venvPython } else { $null }
if (-not $venvVersion -or $venvVersion -lt [version]'3.11.0') {
    $venvDirectory = Join-Path $ProjectRoot '.venv'
    if (Test-Path $venvDirectory) {
        Write-Host 'Replacing the broken project virtual environment...'
        Remove-Item -Recurse -Force $venvDirectory
    }
    Write-Host "Creating the project virtual environment with Python $($basePython.Version)..."
    & $basePython.Path -m venv $venvDirectory
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create .venv.'
    }
}

Write-Host 'Installing backend dependencies from requirements-lock.txt...'
& $venvPython -m pip install -r (Join-Path $ProjectRoot 'requirements-lock.txt')
if ($LASTEXITCODE -ne 0) {
    throw 'Backend dependency installation failed.'
}

$viteScript = Join-Path $FrontendRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $viteScript -PathType Leaf)) {
    Write-Host 'Installing frontend dependencies from package-lock.json...'
    Push-Location $FrontendRoot
    try {
        & $npm.Source ci
        if ($LASTEXITCODE -ne 0) {
            throw 'Frontend dependency installation failed.'
        }
    }
    finally {
        Pop-Location
    }
}

$apiProcess = $null
$frontendProcess = $null
try {
    $apiProcess = Start-Process -FilePath $venvPython `
        -ArgumentList @('-m', 'uvicorn', 'backend.api.main:app', '--host', '127.0.0.1', '--port', '8001') `
        -WorkingDirectory $ProjectRoot -NoNewWindow -PassThru
    $frontendProcess = Start-Process -FilePath $node.Source `
        -ArgumentList @($viteScript, '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
        -WorkingDirectory $FrontendRoot -NoNewWindow -PassThru

    $apiReady = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($apiProcess.HasExited -or $frontendProcess.HasExited) {
            throw 'A server exited during startup. Check the error output above.'
        }
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8001/health' -TimeoutSec 2
            if ($health.status -eq 'healthy') {
                $apiReady = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $apiReady) {
        throw 'The backend did not become healthy within 60 seconds.'
    }

    $frontendReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($frontendProcess.HasExited) {
            throw 'The frontend server exited during startup. Check the error output above.'
        }
        try {
            $null = Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2
            $frontendReady = $true
            break
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $frontendReady) {
        throw 'The frontend did not become ready within 30 seconds.'
    }

    Write-Host 'Application is running: http://127.0.0.1:5173'
    Write-Host 'API health: http://127.0.0.1:8001/health'
    Start-Process 'http://127.0.0.1:5173'

    while (-not $apiProcess.HasExited -and -not $frontendProcess.HasExited) {
        Start-Sleep -Seconds 2
    }
}
finally {
    foreach ($process in @($apiProcess, $frontendProcess)) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id
        }
    }
}
