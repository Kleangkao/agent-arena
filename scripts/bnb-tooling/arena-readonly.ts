import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

async function main() {
  const supportedEnvironment = new Set(["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"])
  for (const key of Object.keys(process.env)) {
    if (!supportedEnvironment.has(key.toUpperCase())) delete process.env[key]
  }
  const network = "bsc-testnet"
  const { registerAgentsTools } = await import("./src/evm/modules/agents/tools.ts")
  const { registerContractTools } = await import("./src/evm/modules/contracts/tools.ts")
  const { registerNetworkTools } = await import("./src/evm/modules/network/tools.ts")
  const { getTransactionReceipt } = await import("./src/evm/services/transactions.ts")
  const { mcpToolRes } = await import("./src/utils/helper.ts")
  const server = new McpServer({ name: "Arena BNB Testnet read tools", version: "1.0.0" })
  const allowedTools = new Set(["get_erc8004_agent", "read_contract", "get_chain_info", "is_contract"])
  const constrainedServer = {
    tool(name: string, description: string, schema: Record<string, z.ZodTypeAny>, handler: (args: object) => Promise<any>) {
      if (!allowedTools.has(name)) return
      const normalizedSchema = name === "read_contract"
        ? { ...schema, abi: z.array(z.object({ stateMutability: z.enum(["view", "pure"]) }).passthrough()).max(16) }
        : schema
      server.tool(name, description, { ...normalizedSchema, network: z.literal(network).default(network) }, async (args) => {
        const result = await handler({ ...args, network })
        if (name !== "get_erc8004_agent") return result
        let agent
        try { agent = JSON.parse(result.content[0].text) } catch { return result }
        return mcpToolRes.success({
          agentId: agent.agentId,
          owner: agent.owner,
          network: agent.network,
          uriScheme: /^(https?|ipfs|data):/.exec(agent.tokenURI)?.[1] ?? "other",
        })
      })
    },
  } as unknown as McpServer
  registerAgentsTools(constrainedServer)
  registerContractTools(constrainedServer)
  registerNetworkTools(constrainedServer)
  server.tool("get_testnet_receipt", "Read a BSC Testnet transaction receipt", {
    hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  }, async ({ hash }) => mcpToolRes.success(await getTransactionReceipt(hash as `0x${string}`, network)))
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not connect BNB Testnet MCP")
  process.exitCode = 1
})
