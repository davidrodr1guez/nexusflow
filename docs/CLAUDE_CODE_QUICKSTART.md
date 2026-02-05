# 🚀 Guía Rápida: NexusFlow con Claude Code

## Setup Inicial (una sola vez)

```bash
# 1. Clona el repo
git clone https://github.com/tu-equipo/nexusflow.git
cd nexusflow

# 2. Instala dependencias
npm install

# 3. Configura environment
cp .env.example .env
# Edita .env con tus API keys

# 4. Instala Foundry (si no lo tienes)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 5. Instala dependencias de Foundry
cd packages/contracts
forge install uniswap/v4-core uniswap/v4-periphery
cd ../..

# 6. Inicia Claude Code
claude
```

## Flujo de Trabajo con Claude Code

### Regla #1: Siempre trabaja en feature branches
```bash
# Claude Code ya tiene un hook que bloquea ediciones en main
git checkout -b feat/yellow-integration
```

### Regla #2: Usa los custom commands
```
/new-adapter yellow      → Scaffolda el Yellow SDK adapter completo
/new-strategy arbitrage  → Scaffolda una nueva estrategia
/submit-check            → Valida que todo está listo para submit
```

### Regla #3: Claude Code tiene skills automáticos
Los skills en `.claude/skills/` se activan automáticamente cuando trabajas en:
- **Integraciones DeFi** → `defi-integration` skill
- **Tests** → `testing-patterns` skill
- **Smart contracts** → `smart-contracts` skill

### Regla #4: /clear entre tareas grandes
Después de completar una integración grande, usa `/clear` para limpiar contexto.

## Plan de Trabajo — Qué pedirle a Claude Code

### Sesión 1: Yellow SDK Integration
```
Implementa el Yellow SDK adapter siguiendo el patrón en
packages/agent/src/protocols/lifi-adapter.ts.
Debe soportar:
- Crear sesión de estado off-chain
- Enviar pagos instantáneos (sin gas)
- Cerrar sesión con settlement on-chain
Usa los docs en https://docs.yellow.org/docs/learn
Escribe tests primero (TDD).
```

### Sesión 2: ENS Integration
```
Implementa la integración ENS para el agente:
1. Resolver nexusflow.eth → dirección del agente
2. Leer text records: swap-preference, risk-level, preferred-chains
3. Escribir text records cuando el agente actualiza preferencias
Usa @ensdomains/ensjs v4.
```

### Sesión 3: Arc/Circle USDC Integration
```
Crea el Arc adapter para USDC cross-chain:
- Depositar USDC en Arc
- Transferir USDC entre chains via Arc
- Retirar USDC a chain destino
Usa Circle Developer SDK y los docs en https://developers.circle.com
```

### Sesión 4: Frontend Dashboard
```
Construye el dashboard React con Vite + Tailwind + Zustand:
- Página principal: portfolio overview, chain allocation chart
- Strategies tab: lista de estrategias con status y métricas
- Agent logs tab: feed en tiempo real de decisiones del agente
- Protocol status: health check de cada integración
Conecta con wagmi + RainbowKit para wallet connection.
```

### Sesión 5: Pulir y Demo
```
Ejecuta /submit-check y arregla todo lo que falle.
Luego:
- Asegura que el video demo muestra cada integración
- README tiene todos los links actualizados
- Architecture diagram está correcto
- .env.example documentado
```

## Parallel Sessions (Advanced)

Puedes correr múltiples instancias de Claude Code en paralelo:

```bash
# Terminal 1: Trabaja en contracts
cd packages/contracts && claude

# Terminal 2: Trabaja en agent
cd packages/agent && claude

# Terminal 3: Trabaja en frontend
cd packages/frontend && claude
```

Cada sesión lee su propio CLAUDE.md local + el root CLAUDE.md.

## Tips Clave

1. **No dejes que Claude adivine** — Siempre dale contexto específico (archivos, docs, patterns)
2. **Review cada diff** — El hook de Prettier formatea automáticamente, pero revisa la lógica
3. **Tests primero** — Claude Code produce mejor código cuando escribe tests antes
4. **Commits pequeños** — Un commit por feature/fix, con conventional commits
5. **BigInt siempre** — Nunca uses `number` para cantidades de tokens

## Deadlines

| Día | Fecha | Objetivo |
|-----|-------|----------|
| 1 | 5 Feb | Setup + Yellow SDK + estructura base |
| 2 | 6 Feb | LI.FI + Uniswap v4 hooks + ENS |
| 3 | 7 Feb | Arc/Circle + Agent strategies |
| 4 | 8 Feb | Frontend dashboard completo |
| 5 | 9 Feb | Testing, polish, demo video |
| 6 | 10 Feb | Submit y preparar presentación |
