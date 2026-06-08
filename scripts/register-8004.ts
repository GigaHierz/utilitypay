/**
 * ERC-8004 Identity Registry — agent registration on Celo MAINNET.
 *
 * ⚠️  MAINNET: this mints a PERMANENT agent NFT and costs real CELO gas.
 *
 * Usage:
 *   1. Put your funded wallet key in .env.local (NOT committed):
 *        PRIVATE_KEY=0x...
 *        AGENT_METADATA_URI=https://<your-domain>/agent.json   # where public/agent.json is served
 *        # optional: pay gas in a stablecoin instead of CELO (USDC adapter shown)
 *        # FEE_CURRENCY=0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
 *   2. Run:
 *        npx tsx scripts/register-8004.ts
 *
 * Prints your agentId, the tx hash, and your 8004scan link.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); // template keeps secrets in .env.local, not .env
config(); // also load .env if present
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

// Minimal ABI: the single-arg register overload + the Transfer event (agentId = tokenId) + reads.
const ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

async function main() {
  const rawPk = process.env.PRIVATE_KEY;
  if (!rawPk) throw new Error("Set PRIVATE_KEY in .env.local (your funded mainnet wallet).");
  // Normalize: viem requires a 0x-prefixed 32-byte hex key.
  const pk = (rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`) as `0x${string}`;

  const agentURI = process.env.AGENT_METADATA_URI;
  if (!agentURI) throw new Error("Set AGENT_METADATA_URI in .env.local (public URL of agent.json).");

  const feeCurrency = process.env.FEE_CURRENCY as `0x${string}` | undefined;

  const account = privateKeyToAccount(pk);
  const transport = http("https://forno.celo.org");
  const publicClient = createPublicClient({ chain: celo, transport });
  const walletClient = createWalletClient({ account, chain: celo, transport });

  console.log(`Registering agent owned by ${account.address}`);
  console.log(`Metadata URI: ${agentURI}`);
  console.log(`Gas paid in: ${feeCurrency ? `stablecoin (${feeCurrency})` : "CELO"}`);

  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: ABI,
    functionName: "register",
    args: [agentURI],
    ...(feeCurrency ? { feeCurrency } : {}),
  });
  console.log(`\nSubmitted: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: ABI, eventName: "Transfer", logs: receipt.logs });
  const minted = logs.find((l) => l.args.from === "0x0000000000000000000000000000000000000000");
  const agentId = minted?.args.tokenId;

  if (agentId === undefined) {
    console.log("Registered, but could not parse agentId from logs. Check the tx on Celoscan.");
    return;
  }

  console.log(`\n✅ Registered. agentId = ${agentId}`);
  console.log(`   Celoscan:  https://celoscan.io/tx/${hash}`);
  console.log(`   8004scan:  https://8004scan.io/agent/${agentId}?chain=42220`);
  console.log(`\nUse this agentId in your hackathon registration tweet.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
