import assert from "node:assert/strict"
import { resolve } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { decodeEventLog, parseAbi } from "viem"

const repo = process.cwd()
const checkout = import.meta.dirname
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(repo, "node_modules/tsx/dist/cli.mjs"), "--tsconfig", resolve(checkout, "tsconfig.json"), resolve(checkout, "arena-readonly.ts")],
  cwd: checkout,
})
const client = new Client({ name: "ARENA read verification", version: "1.0.0" })
await client.connect(transport)
try {
  const { tools } = await client.listTools()
  const toolNames = tools.map((tool) => tool.name).sort()
  assert.deepEqual(toolNames, ["get_chain_info", "get_erc8004_agent", "get_testnet_receipt", "is_contract", "read_contract"])
  const rejected = await client.callTool({ name: "get_chain_info", arguments: { network: "bsc" } }).catch(() => ({ isError: true }))
  assert.equal(rejected.isError, true)
  const writeRejected = await client.callTool({ name: "register_erc8004_agent", arguments: {} }).catch(() => ({ isError: true }))
  assert.equal(writeRejected.isError, true)
  const read = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args })
    assert.equal(Boolean(result.isError), false)
    return JSON.parse(result.content[0].text)
  }
  const address = "0xbd1a8427da0b2b2d947a391ed117e49ec8801f81"
  const transactionHash = "0xccd05b0c93c3c7931b9c77575894dc78c7bd9850b6a0e35f760ab2c6e61cacb6"
  const matchKey = "0x105ab716ea579c79d91f2ba15323f5793f8d70915314048c445320e188e52e6f"
  const replayHash = "0xea56e3697b2005aed0a13b2d534ce7a4b204cb6c7c59d2e43ef6ffea21f6c279"
  const identityRegistry = "0x8004A818BFB912233c491871b3d84c89A494BD9e"
  const commanderId = "2933"
  const commanderOwner = "0x0f7340C0B93377f4c59d0ACCcc076991bb872E30"
  const commanderRegistration = "0xfaf23fdba98496e60bd637f74ee410f4f64e59d7c7caa7caed9988a7ee08fa7e"
  const commanderProfile = "https://agent-arena-preview.vercel.app/agent-arena-commander.json"
  const [chain, registry, record, receipt, agent, commander, registration, profile] = await Promise.all([
    read("get_chain_info"),
    read("is_contract", { address }),
    read("read_contract", { contractAddress: address, functionName: "records", args: [matchKey], abi: [{
      name: "records", type: "function", stateMutability: "view", inputs: [{ name: "matchKey", type: "bytes32" }], outputs: [
        { name: "replayHash", type: "bytes32" }, { name: "blockNumber", type: "uint64" }
      ]
    }] }),
    read("get_testnet_receipt", { hash: transactionHash }),
    read("get_erc8004_agent", { agentId: "100" }),
    read("get_erc8004_agent", { agentId: commanderId }),
    read("get_testnet_receipt", { hash: commanderRegistration }),
    read("read_contract", { contractAddress: identityRegistry, functionName: "tokenURI", args: [commanderId],
      abi: parseAbi(["function tokenURI(uint256 tokenId) view returns (string)"]) }),
  ])
  assert.equal(chain.chainId, 97)
  assert.equal(registry.isContract, true)
  assert.deepEqual(record, [replayHash, "145018920"])
  assert.equal(receipt.to.toLowerCase(), address)
  assert.equal(receipt.status, "success")
  assert.equal(receipt.blockNumber, record[1])
  assert.equal(receipt.logs.some((log) => log.address.toLowerCase() === address && log.topics[1] === matchKey && log.topics[2] === replayHash), true)
  assert.match(agent.owner, /^0x[0-9a-fA-F]{40}$/)
  assert.equal(agent.agentId, "100")
  assert.equal(commander.agentId, commanderId)
  assert.equal(commander.owner, commanderOwner)
  assert.equal(profile, commanderProfile)
  assert.equal(registration.status, "success")
  assert.equal(registration.to.toLowerCase(), identityRegistry.toLowerCase())
  const eventAbi = parseAbi(["event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"])
  const registered = registration.logs.filter((log) => log.address.toLowerCase() === identityRegistry.toLowerCase()).some((log) => {
    try {
      const { args } = decodeEventLog({ abi: eventAbi, data: log.data, topics: log.topics })
      return args.agentId === BigInt(commanderId) && args.agentURI === profile && args.owner === commanderOwner
    } catch { return false }
  })
  assert.equal(registered, true)
  assert.ok(BigInt(chain.blockNumber) > BigInt(registration.blockNumber))
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), protocol: "MCP stdio",
    officialSourceCommit: "3bd45604ee729857b0f6f114ed08357d8dd8d10e",
    toolNames, rejectedMainnetRequest: true, rejectedWriteRequest: true, chain,
    commitment: { address, matchKey, replayHash, transactionHash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, confirmations: (BigInt(chain.blockNumber) - BigInt(receipt.blockNumber) + 1n).toString() },
    externalIdentity: { chainId: 97, registryAddress: identityRegistry, id: agent.agentId, owner: agent.owner, uriScheme: agent.uriScheme, arenaLinked: false },
    arenaCommander: {
      chainId: 97, registryAddress: identityRegistry, id: commanderId, owner: commander.owner, profile,
      transactionHash: commanderRegistration, blockNumber: registration.blockNumber, gasUsed: registration.gasUsed,
      confirmations: (BigInt(chain.blockNumber) - BigInt(registration.blockNumber) + 1n).toString(),
      eventMatches: registered, matchEvidenceLinked: false,
    },
  }, null, 2))
} finally {
  await client.close()
}
