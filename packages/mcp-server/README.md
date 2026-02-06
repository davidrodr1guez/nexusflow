# @nexusflow/mcp-server

MCP (Model Context Protocol) server that exposes the NexusFlow AI DeFi agent as composable tools. Any MCP-compatible client — Claude Desktop, Cursor, VS Code, Claude Code, etc. — can interact with cross-chain DeFi operations through natural language.

## Tools

| Tool | Description |
|------|-------------|
| `nexusflow_portfolio` | Get portfolio value and per-chain balances |
| `nexusflow_yields` | Browse best cross-chain yield opportunities |
| `nexusflow_swap` | Execute a token swap via LI.FI |
| `nexusflow_bridge` | Bridge assets cross-chain via LI.FI or Circle CCTP |
| `nexusflow_preferences` | Read/write agent preferences (ENS text records) |
| `nexusflow_agent_status` | Agent runtime status, strategy metrics, protocol health |

## Build

```bash
npm install
npm run build
```

## Connect to Claude Desktop

Add this to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nexusflow": {
      "command": "node",
      "args": ["/absolute/path/to/nexusflow/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Or if installed globally via `npm link`:

```json
{
  "mcpServers": {
    "nexusflow": {
      "command": "nexusflow-mcp"
    }
  }
}
```

## Connect to Claude Code

```bash
claude mcp add nexusflow node /absolute/path/to/nexusflow/packages/mcp-server/dist/index.js
```

## Connect to Cursor

In Cursor Settings > MCP Servers, add:

```json
{
  "nexusflow": {
    "command": "node",
    "args": ["/absolute/path/to/nexusflow/packages/mcp-server/dist/index.js"]
  }
}
```

## Connect to VS Code (Copilot)

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "nexusflow": {
      "command": "node",
      "args": ["${workspaceFolder}/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm run dev          # Run with tsx (hot reload)
npm run typecheck    # Type-check without emitting
npm run test         # Run tests
```

## Example Usage

Once connected, you can ask your AI assistant things like:

- "Show me my NexusFlow portfolio"
- "What are the best yield opportunities on Arbitrum?"
- "Swap 100 USDC for WETH on Base"
- "Bridge 500 USDC from Ethereum to Arbitrum using Circle CCTP"
- "What are my agent's current preferences?"
- "Is the NexusFlow agent running? Show me its metrics"
