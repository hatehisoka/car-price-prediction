# Автоматична установка проєкту на Windows.
# Запуск з PowerShell:  .\setup.ps1
# Якщо PowerShell ругаєцся на script policy — спочатку:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

# ───── 1. Python ─────
Step "Перевіряю Python..."
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Die "Python не знайдено. Встанови: https://python.org/downloads"
}
python --version

# ───── 2. Virtualenv ─────
if (Test-Path ".venv") {
    Warn ".venv уже існує — використовую наявний"
} else {
    Step "Створюю .venv..."
    python -m venv .venv
}

$activate = ".\.venv\Scripts\Activate.ps1"
& $activate

Step "Оновлюю pip..."
python -m pip install --quiet --upgrade pip

Step "Встановлюю Python-залежності..."
pip install --quiet -r requirements.txt
Write-Host "  ✓ FastAPI, scikit-learn, pandas встановлено"

# ───── 3. Тренування моделі ─────
if ((Test-Path "car_model.pkl") -and (Test-Path "model_metrics.json")) {
    Warn "car_model.pkl уже існує — пропускаю тренування"
    Warn "Щоб перетренувати: del car_model.pkl ; .\setup.ps1"
} else {
    Step "Тренування моделі (30–60 сек)..."
    python train_model.py
}

# ───── 4. Node ─────
Step "Перевіряю Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Die "Node.js не знайдено. Встанови: https://nodejs.org (мінімум v20)"
}
$nodeVer = (node --version).TrimStart("v")
$major = [int]($nodeVer.Split(".")[0])
Write-Host "  Node v$nodeVer"
if ($major -lt 20) { Warn "Node старіший за v20 — Vite 8 може не працювати" }

# ───── 5. Frontend ─────
Step "Встановлюю npm-залежності (~1-2 хв)..."
Set-Location frontend
npm install --silent
Set-Location ..

# ───── 6. Готово ─────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✓ Установка завершена!"                                   -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Запусти у двох окремих терміналах PowerShell:"
Write-Host ""
Write-Host "  # Термінал 1 (бекенд):" -ForegroundColor Yellow
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  uvicorn main:app --reload"
Write-Host ""
Write-Host "  # Термінал 2 (фронтенд):" -ForegroundColor Yellow
Write-Host "  cd frontend"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Потім відкрий http://localhost:5173"
Write-Host ""
