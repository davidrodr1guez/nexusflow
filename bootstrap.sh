#!/bin/bash
# ============================================================
# NexusFlow — Bootstrap Completo
# 
# UN SOLO COMANDO para instalar todo y configurar el proyecto.
# Uso: curl -sL <URL> | bash  O  bash bootstrap.sh
# ============================================================

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[NexusFlow]${NC} $1"; }
warn() { echo -e "${YELLOW}[NexusFlow]${NC} $1"; }
fail() { echo -e "${RED}[NexusFlow] ERROR:${NC} $1"; exit 1; }

# ============================================================
# 1. Detectar OS
# ============================================================
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi
log "Detected OS: $OS"

# ============================================================
# 2. Instalar Git si no existe
# ============================================================
if ! command -v git &> /dev/null; then
    log "Installing Git..."
    if [[ "$OS" == "mac" ]]; then
        xcode-select --install 2>/dev/null || true
        # Esperar a que termine
        until command -v git &> /dev/null; do sleep 5; done
    elif [[ "$OS" == "linux" ]]; then
        sudo apt-get update -qq && sudo apt-get install -y -qq git
    fi
fi
log "✅ Git $(git --version | cut -d' ' -f3)"

# ============================================================
# 3. Instalar Node.js 20+ si no existe o es viejo
# ============================================================
NEED_NODE=false
if ! command -v node &> /dev/null; then
    NEED_NODE=true
elif [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
    NEED_NODE=true
fi

if $NEED_NODE; then
    log "Installing Node.js 20 via nvm..."
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
        curl -so- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20 --default
    nvm use 20
fi
# Asegurar que nvm está cargado
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
log "✅ Node $(node -v)"

# ============================================================
# 4. Instalar Foundry si no existe
# ============================================================
if ! command -v forge &> /dev/null; then
    log "Installing Foundry..."
    curl -sL https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
    foundryup
fi
export PATH="$HOME/.foundry/bin:$PATH"
log "✅ Foundry $(forge --version 2>/dev/null | head -1 || echo 'installed')"

# ============================================================
# 5. Verificar Claude Code
# ============================================================
if ! command -v claude &> /dev/null; then
    log "Installing Claude Code..."
    npm install -g @anthropic-ai/claude-code
fi
log "✅ Claude Code installed"

# ============================================================
# 6. Crear directorio del proyecto
# ============================================================
PROJECT_DIR="$HOME/nexusflow"
if [ -d "$PROJECT_DIR" ]; then
    warn "Project directory already exists at $PROJECT_DIR"
    warn "Backing up to ${PROJECT_DIR}.bak"
    mv "$PROJECT_DIR" "${PROJECT_DIR}.bak.$(date +%s)"
fi

log "Creating project at $PROJECT_DIR..."

# Si el tar.gz existe en el directorio actual, descomprimirlo
if [ -f "nexusflow-project.tar.gz" ]; then
    tar xzf nexusflow-project.tar.gz -C "$HOME/"
elif [ -f "$HOME/Downloads/nexusflow-project.tar.gz" ]; then
    tar xzf "$HOME/Downloads/nexusflow-project.tar.gz" -C "$HOME/"
else
    warn "nexusflow-project.tar.gz not found — will create from scratch"
    mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# ============================================================
# 7. Inicializar Git
# ============================================================
if [ ! -d ".git" ]; then
    git init
    git add -A
    git commit -m "feat: initial project scaffold"
fi
git checkout -b dev 2>/dev/null || git checkout dev

# ============================================================
# 8. Crear .env con placeholders
# ============================================================
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    log "Created .env from .env.example — fill in your API keys later"
fi

# ============================================================
# 9. Instalar dependencias npm
# ============================================================
log "Installing npm dependencies..."
npm install --legacy-peer-deps 2>/dev/null || npm install

# ============================================================
# 10. Instalar dependencias Foundry
# ============================================================
if [ -d "packages/contracts" ]; then
    log "Installing Foundry dependencies..."
    cd packages/contracts
    forge install uniswap/v4-core --no-commit 2>/dev/null || true
    forge install uniswap/v4-periphery --no-commit 2>/dev/null || true
    forge install OpenZeppelin/openzeppelin-contracts --no-commit 2>/dev/null || true
    cd ../..
fi

# ============================================================
# 11. Resumen final
# ============================================================
echo ""
echo "============================================================"
echo -e "${GREEN}  ✅ NexusFlow — Setup Complete!${NC}"
echo "============================================================"
echo ""
echo "  Project:   $PROJECT_DIR"
echo "  Node:      $(node -v)"
echo "  Foundry:   $(forge --version 2>/dev/null | head -1 || echo 'check manually')"
echo "  Git:       $(git --version | cut -d' ' -f3)"
echo ""
echo "  NEXT STEPS:"
echo "  1. cd $PROJECT_DIR"
echo "  2. Fill in .env with your API keys (Alchemy, Circle, etc)"
echo "  3. Run: claude"
echo "  4. Paste the mega-prompt from CLAUDE_CODE_MEGA_PROMPT.md"
echo ""
echo "============================================================"
