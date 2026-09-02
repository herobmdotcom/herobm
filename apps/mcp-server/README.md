# HeroBM MCP Server

This directory contains the Model Context Protocol (MCP) server for HeroBM. It provides an interface for AI agents and assistants (like Cursor, Claude Desktop, etc.) to securely interact with the HeroBM API and Database.

## Installation / Configuration in AI Clients

Agent platforms **do not auto-discover** MCP servers. You must manually register this server in your AI client's settings. 

The command to run the server locally is:
```bash
npm run dev -s -w apps/mcp-server
```
*(The `-s` flag is critical because npm's output breaks the JSON-RPC parser).*

### Cursor
1. Go to **Settings > Features > MCP Servers**
2. Click **+ Add new MCP server**
3. Name: `herobm`
4. Type: `command`
5. Command: `npm run dev -s -w apps/mcp-server`
6. Make sure to run Cursor from the root of the HeroBM workspace, or use an absolute path to the workspace in a custom wrapper script.

### Claude Desktop
Add the following to your `claude_desktop_config.json` file:
*(On Windows: `%APPDATA%\Claude\claude_desktop_config.json`)*
*(On Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`)*

```json
{
  "mcpServers": {
    "herobm": {
      "command": "npm",
      "args": ["run", "dev", "-s", "-w", "apps/mcp-server"],
      "cwd": "ABSOLUTE_PATH_TO_HEROBM_ROOT"
    }
  }
}
```
*(Remember to replace `ABSOLUTE_PATH_TO_HEROBM_ROOT` with the actual path to the herobm-monorepo folder on your machine).*

## Manual Testing (Inspector)

If you want to manually test the tools from a web browser without an AI agent, you can launch the official MCP Inspector from the root directory:

```bash
make dev-mcp
# Or: npx @modelcontextprotocol/inspector npm run dev -s -w apps/mcp-server
```
