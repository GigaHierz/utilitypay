/**
 * Fetch the agentId (ERC-721 tokenId) minted by an ERC-8004 register() tx.
 * Usage: npx tsx scripts/get-agent-id.ts <txHash>
 */
import { createPublicClient, http, parseEventLogs } from "viem";
import { celo } from "viem/chains";

const TRANSFER_ABI = [
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
  const hash = (process.argv[2] || "") as `0x${string}`;
  if (!hash) throw new Error("Pass the tx hash: npx tsx scripts/get-agent-id.ts <txHash>");

  const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const receipt = await publicClient.getTransactionReceipt({ hash });

  const logs = parseEventLogs({ abi: TRANSFER_ABI, eventName: "Transfer", logs: receipt.logs });
  const mint = logs.find((l) => l.args.from === "0x0000000000000000000000000000000000000000");
  const agentId = mint?.args.tokenId;

  if (agentId === undefined) {
    console.log("No mint Transfer event found in this tx.");
    return;
  }
  console.log(`status:   ${receipt.status}`);
  console.log(`agentId:  ${agentId}`);
  console.log(`owner:    ${mint?.args.to}`);
  console.log(`8004scan: https://8004scan.io/agent/${agentId}?chain=42220`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
