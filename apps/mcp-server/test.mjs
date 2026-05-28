import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  console.log("Connecting...");
  await client.connect(transport);
  console.log("Connected!");

  console.log("Listing tools...");
  const tools = await client.listTools();
  
  const targetTool = tools.tools.find(t => t.name === "ProductsController_findAll");
  if (targetTool) {
    console.log("Found ProductsController_findAll:");
    console.dir(targetTool.inputSchema, { depth: null });
  } else {
    console.log("Tool not found!");
  }
  
  process.exit(0);
}

main().catch(console.error);
