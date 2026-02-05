# 🧠 MEGA PROMPT — Pega esto en Claude Code

## Cómo usar

### Opción A: Automatización total (recomendado)
```bash
cd ~/nexusflow
claude --dangerously-skip-permissions
```
Luego pega el prompt de abajo. Claude Code trabajará sin pedirte permiso para nada.

### Opción B: Con permisos (más seguro pero más lento)
```bash
cd ~/nexusflow
claude
```
Pega el prompt de abajo. Claude Code te pedirá permiso para cada archivo/comando.

---

## EL PROMPT — Copia TODO lo que está dentro del bloque de abajo

```
Eres un ingeniero senior construyendo un proyecto para ganar ETHGlobal HackMoney 2026.
El proyecto se llama NexusFlow — un agente AI DeFi cross-chain con identidad ENS.

Lee el CLAUDE.md del proyecto para entender la arquitectura completa.

Tu misión: construir TODO el proyecto de principio a fin. No pares hasta que:
1. El frontend compile y corra sin errores
2. Los smart contracts compilen y todos los tests pasen
3. El agente compile y todos los tests pasen
4. Todas las integraciones (LI.FI, Yellow, ENS, Arc, Uniswap v4) estén implementadas

Trabaja en este orden exacto. Después de cada bloque, ejecuta los tests para verificar.

═══════════════════════════════════════════
BLOQUE 1: FRONTEND (packages/frontend/)
═══════════════════════════════════════════

Inicializa el frontend completo:

a) Crea vite.config.ts, tailwind.config.js, postcss.config.js, index.html
b) Crea src/main.tsx como entry point con React 18 + Tailwind
c) Configura wagmi v2 + RainbowKit v2 + viem para wallet connection en src/lib/wagmi.ts
d) Crea src/stores/agent-store.ts con Zustand:
   - portfolioValue, chainBalances, agentRunning, logs, protocolStatus, strategies
   - Datos mock iniciales que se vean realistas
e) Crea src/App.tsx con layout:
   - Header: logo "NexusFlow" (letra N en cuadrado verde #00D395), "nexusflow.eth", 
     Connect Wallet button via RainbowKit
   - Tabs: Overview | Strategies | Logs
   - Toggle button: "Agent Running" / "Agent Paused"
f) Crea src/components/Overview.tsx:
   - 4 stat cards: Total Portfolio ($45,121.79), Active Strategies (3/4), 
     24h Volume ($47,832), Yellow Sessions (847 — Gas saved $124)
   - Portfolio chart: Recharts AreaChart, 30 días, gradiente verde
   - Chain allocation: Recharts PieChart (Ethereum $12,450, Arbitrum $8,920, 
     Optimism $5,340, Base $3,210, Arc USDC $15,200)
   - Protocol integrations: 5 cards con status dot y nombre 
     (LI.FI, Uniswap v4, Yellow SDK, Arc/Circle, ENS) — todos "connected"
g) Crea src/components/Strategies.tsx:
   - 4 cards: Yield Optimizer (active, 12.4% APY, $18,200, Medium risk),
     Arbitrage Scanner (active, 8.7% APY, $9,400, Low risk),
     LP Rebalancer (paused, 15.2% APY, $12,600, High risk),
     USDC Yield (active, 6.1% APY, $15,200, Low risk)
   - Cada card con descripción y métricas
h) Crea src/components/AgentLogs.tsx:
   - Feed de logs mock mostrando un flujo completo:
     14:32:08 EXECUTE "Bridge 2,400 USDC → Arbitrum via LI.FI" ✓
     14:31:55 DECIDE "Yield opportunity: Uniswap v4 ETH/USDC on Arbitrum at 14.2% APY" →
     14:31:42 MONITOR "Scanning cross-chain yields across 5 chains..." ◉
     14:30:18 EXECUTE "Yellow SDK: Instant session payment 0.5 USDC (gas-free)" ✓
     14:29:55 EXECUTE "Settled Uniswap v4 LP position — earned 12.3 USDC fees" ✓
     14:28:30 DECIDE "Rebalance triggered: Base allocation below 8% threshold" →
     14:27:12 MONITOR "ENS text records updated: swap-preference=low-slippage" ◉
     14:26:45 EXECUTE "Arc USDC transfer: 1,000 USDC cross-chain settlement" ✓
   - Colores: monitor=#627EEA, decide=#FFB020, execute=#00D395, error=#FF4757
   - Animación slide-in en cada log entry
i) Crea src/components/EnsIdentityBar.tsx:
   - Barra inferior con: 🏷️ nexusflow.eth
   - Text records: swap-pref=low-slippage, risk=medium, chains=eth,arb,op,base
   - Stats: Yellow Sessions: 847, Gas Saved: $124.32, Uniswap v4 Hooks: 3 active

Diseño: dark theme (#0a0a0f fondo, #161b22 cards, #30363d borders), 
acento verde #00D395, fuente JetBrains Mono para datos (importar de Google Fonts), 
Space Grotesk para headings. Cards con hover effect, border-glow sutil.
Efecto scanline ultra sutil (opacity 0.02) en el background.

Después de crear todo, ejecuta: cd packages/frontend && npm run dev
Verifica que compila sin errores. Arregla cualquier error.

═══════════════════════════════════════════
BLOQUE 2: SMART CONTRACTS (packages/contracts/)
═══════════════════════════════════════════

a) Verifica que NexusHook.sol compila: forge build
   Si hay errores de imports, arregla los paths para lib/v4-core y lib/v4-periphery.
   Si las interfaces de v4-core cambiaron, adapta el contrato.

b) Crea test/NexusHook.t.sol:
   - test_hookPermissions: beforeSwap y afterSwap activos
   - test_onlyAgentCanSetPrivacyMode: reverts si no es agent
   - test_privacyModeBlocksLargeSwap: con privacy ON, swap > maxSize reverts
   - test_afterSwapUpdatesAnalytics: swapCount y cumulativeVolume incrementan
   - test_setMaxSwapSize: agent puede cambiar el max size

c) Crea script/Deploy.s.sol para deployment a Sepolia

d) Ejecuta: forge test -vvv
   Todos los tests deben pasar. Arregla cualquier error.

═══════════════════════════════════════════
BLOQUE 3: AGENT — Core + LI.FI (packages/agent/)
═══════════════════════════════════════════

a) Verifica que el TypeScript existente compila: npx tsc --noEmit
   Arregla cualquier error de tipos o imports.

b) Completa el LiFi adapter (lifi-adapter.ts ya tiene la base):
   - getQuote: construye query params y llama a li.quest/v1/quote
   - executeSwap: simula ejecución con txHash generado
   - getBridgeQuote: similar a getQuote pero para bridge
   - executeBridge: simula ejecución

c) Crea test/protocols/lifi-adapter.test.ts:
   - Mock global fetch()
   - Test getQuote retorna SwapQuote válida
   - Test executeSwap retorna TransactionResult con success=true
   - Test healthCheck retorna true cuando API responde

d) Crea test/agent-brain.test.ts:
   - Test que el AgentBrain se construye correctamente
   - Test isRunning() cambia con start/stop
   - Test getLogs() retorna array de logs

e) Ejecuta: npx vitest run — todos los tests deben pasar.

═══════════════════════════════════════════
BLOQUE 4: AGENT — Yellow SDK Adapter
═══════════════════════════════════════════

Crea packages/agent/src/protocols/yellow-adapter.ts:

Yellow Network usa state channels (Nitrolite protocol):
- Abres sesión → deposit on-chain una vez
- Pagos off-chain → instantáneos, sin gas
- Cierras sesión → settlement on-chain final

Implementa IProtocolAdapter + métodos custom:
- createSession(counterparty, depositAmount): abre state channel
- sendPayment(sessionId, amount): pago instantáneo off-chain  
- getSessionBalance(sessionId): balance actual del canal
- closeSession(sessionId): settlement on-chain

Incluye tipos: SessionInfo, PaymentResult, SessionStatus.
Implementa con HTTP API calls (o simulado con lógica realista).
Logging estructurado con el logger module.

Crea test/protocols/yellow-adapter.test.ts con mocks.
Registra el adapter en protocols/index.ts.
Ejecuta tests.

═══════════════════════════════════════════
BLOQUE 5: AGENT — ENS Adapter
═══════════════════════════════════════════

Crea packages/agent/src/protocols/ens-adapter.ts:

Usa viem para interactuar con ENS (no necesita @ensdomains/ensjs 
si es más simple con viem directamente — normalize con viem/ens).

Métodos:
- resolveName(name): nombre → dirección (0x...)
- getTextRecord(name, key): lee un text record
- getAgentPreferences(name): lee todos los text records del agente y devuelve AgentPreferences:
  - "nexusflow:swap-pref" → maxSlippageBps
  - "nexusflow:risk" → riskLevel
  - "nexusflow:chains" → preferredChains
  - "nexusflow:rebalance-threshold" → rebalanceThresholdPct
- setTextRecord(name, key, value): escribe text record

Esto es CLAVE para el premio ENS: el agente DeFi configura su comportamiento 
leyendo ENS text records. Es creativo y útil.

Crea tests con mocks. Registra en el registry. Ejecuta tests.

═══════════════════════════════════════════
BLOQUE 6: AGENT — Arc/Circle Adapter
═══════════════════════════════════════════

Crea packages/agent/src/protocols/arc-adapter.ts:

Integra con Circle Developer Platform para USDC cross-chain via Arc.
API Base: https://api.circle.com (sandbox mode por defecto).

Métodos:
- createWallet(): crea wallet programática Circle
- getUsdcBalance(walletId): consulta balance USDC
- transferCrossChain(fromChain, toChain, amount, recipient): mueve USDC
- getTransferStatus(transferId): estado de la transferencia

Headers: Authorization: Bearer ${CIRCLE_API_KEY}, Content-Type: application/json

Agrega un bloque de comentarios al final del archivo con "Product Feedback" 
para Circle/Arc (3-4 puntos sobre la experiencia de integración) — 
esto es requerido para el premio de Arc.

Crea tests. Registra. Ejecuta tests.

═══════════════════════════════════════════
BLOQUE 7: AGENT — Strategies
═══════════════════════════════════════════

a) Crea packages/agent/src/strategies/types.ts si no existe,
   asegurando que IStrategy está definida con: id, name, getStatus(), 
   evaluate(state), execute(action), getMetrics()

b) Crea packages/agent/src/strategies/yield-optimizer.ts:
   - evaluate(): compara yields simulados entre chains.
     Si encuentra >2% diferencia, retorna StrategyAction tipo 'bridge' + 'swap'
   - execute(): llama LiFi adapter para bridge, luego simula Uniswap v4 swap
   - getMetrics(): retorna métricas con APY 12.4%, PnL acumulado, etc.

c) Crea packages/agent/src/strategies/rebalancer.ts:
   - evaluate(): chequea distribución por chain vs targets.
     Si desvío >5%, retorna StrategyAction tipo 'rebalance'
   - execute(): usa LiFi para mover assets + Yellow SDK para micro-payment del fee
   - getMetrics(): métricas de rebalanceo

d) Registra ambas en strategies/index.ts

e) Actualiza agent-brain.ts:
   - Importa y registra ambas estrategias en el constructor
   - El monitor() actualiza state con datos mock realistas
   - El decide() pasa state a cada estrategia activa
   - El execute() llama al adapter correcto

f) Crea tests para ambas estrategias. Ejecuta todos los tests: npx vitest run

═══════════════════════════════════════════
BLOQUE 8: INTEGRACIÓN FINAL + VERIFICACIÓN
═══════════════════════════════════════════

a) Desde la raíz del proyecto, ejecuta: npm run test
   TODOS los tests de TODOS los packages deben pasar.
   Si algo falla, arréglalo.

b) Ejecuta: cd packages/frontend && npm run build
   El frontend debe hacer build de producción sin errores.

c) Verifica que: cd packages/contracts && forge build
   Compila sin errores.

d) Actualiza el README.md:
   - Asegúrate de que el architecture diagram está correcto
   - Todos los prize tracks listados
   - Setup instructions funcionan

e) Haz un resumen final de TODO lo que construiste:
   - Lista de archivos creados
   - Tests que pasan
   - Integraciones completadas
   - Qué falta para el submit (video, deploy, GitHub push)

Cuando termines con todo, dame un reporte completo del estado del proyecto.
```

---

## DESPUÉS DEL MEGA PROMPT

Cuando Claude Code termine (puede tomar 30-60 minutos), solo necesitas:

1. **Llenar .env** con tus API keys reales
2. **Crear repo en GitHub** y hacer push
3. **Grabar video demo** de 3 minutos
4. **Submit** en ethglobal.com

Esas 4 cosas SÍ requieren acción manual (crear cuentas, grabar pantalla, click en submit).
Todo lo demás lo hizo Claude Code por ti.
