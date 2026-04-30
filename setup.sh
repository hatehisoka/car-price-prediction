#!/usr/bin/env bash
# Автоматична установка проєкту на macOS / Linux.
# Запуск: bash setup.sh   (або  ./setup.sh   після chmod +x)
set -e

cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

step()   { echo -e "\n${GREEN}▶ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠ $1${RESET}"; }
err()    { echo -e "${RED}✗ $1${RESET}" >&2; exit 1; }

# ───── 1. Python ─────
step "Перевіряю Python..."
command -v python3 >/dev/null || err "Python 3 не знайдено. Встанови: https://python.org/downloads"
PY_VERSION=$(python3 --version 2>&1)
echo "  $PY_VERSION"

# ───── 2. Virtualenv ─────
if [ -d ".venv" ]; then
    warn ".venv уже існує — використовую наявний"
else
    step "Створюю .venv..."
    python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

step "Оновлюю pip..."
pip install --quiet --upgrade pip

step "Встановлюю Python-залежності..."
pip install --quiet -r requirements.txt
echo "  ✓ FastAPI, scikit-learn, pandas та інші встановлено"

# ───── 3. Тренування моделі ─────
if [ -f "car_model.pkl" ] && [ -f "model_metrics.json" ]; then
    warn "car_model.pkl уже існує — пропускаю тренування"
    warn "Щоб перетренувати: rm car_model.pkl && bash setup.sh"
else
    step "Тренування моделі (30–60 сек)..."
    python train_model.py
fi

# ───── 4. Node / npm ─────
step "Перевіряю Node.js..."
command -v node >/dev/null || err "Node.js не знайдено. Встанови: https://nodejs.org (мінімум v20)"
command -v npm  >/dev/null || err "npm не знайдено"
NODE_VERSION=$(node --version)
echo "  Node $NODE_VERSION"
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
    warn "Node $NODE_VERSION старіший за v20 — Vite 8 може не працювати"
fi

# ───── 5. Frontend ─────
step "Встановлюю npm-залежності (~1-2 хв)..."
cd frontend
npm install --silent

# Знімаємо macOS-карантин з нативних бінарників (інакше Vite падає)
if [[ "$OSTYPE" == "darwin"* ]]; then
    step "macOS: знімаю карантин з node_modules..."
    xattr -dr com.apple.quarantine node_modules/ 2>/dev/null || true
fi

cd ..

# ───── 6. Готово ─────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}✓ Установка завершена!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "Запусти у двох окремих терміналах:"
echo ""
echo -e "  ${YELLOW}# Термінал 1 (бекенд):${RESET}"
echo "  source .venv/bin/activate"
echo "  uvicorn main:app --reload"
echo ""
echo -e "  ${YELLOW}# Термінал 2 (фронтенд):${RESET}"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Потім відкрий http://localhost:5173"
echo ""
