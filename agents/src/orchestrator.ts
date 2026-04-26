import { runClientAgent } from "./clientAgent";
import { runFreelancerAgent } from "./freelancerAgent";
import { runVerifierAgent } from "./verifierAgent";
import { provider, CONTRACT_ADDRESSES, REPUTATION_ABI, freelancerWallet } from "./config";
import { ethers } from "ethers";

async function registerAgentsIfNeeded() {
  const registry = new ethers.Contract(
    CONTRACT_ADDRESSES.ReputationRegistry,
    REPUTATION_ABI,
    freelancerWallet
  );

  const profile = await registry.getProfile(freelancerWallet.address);

  if (!profile.registered) {
    console.log("Registering freelancer agent on-chain...");
    const tx = await registry.registerAgent("did:kite:freelancer-001");
    await tx.wait();
    console.log("Freelancer registered:", freelancerWallet.address);
  } else {
    console.log("Freelancer already registered. Reputation score:", profile.reputationScore.toString());
  }
}

async function runFullCycle() {
  console.log("================================================");
  console.log("  KITE FREELANCER MARKETPLACE — FULL DEMO CYCLE");
  console.log("================================================");
  console.log("Contracts:");
  console.log("  JobBoard:           ", CONTRACT_ADDRESSES.JobBoard);
  console.log("  Escrow:             ", CONTRACT_ADDRESSES.Escrow);
  console.log("  ReputationRegistry: ", CONTRACT_ADDRESSES.ReputationRegistry);

  const network = await provider.getNetwork();
  console.log("  Network:", network.name, "| Chain ID:", network.chainId.toString());
  console.log("================================================\n");

  try {
    await registerAgentsIfNeeded();
    // Phase 1: Client posts job + funds escrow
    const jobId = await runClientAgent(
      "Write a 200-word technical blog post about how blockchain escrow works",
      0.0001 // 0.1 USDC bounty
    );

    console.log("\n------------------------------------------------");

    // Phase 2: Freelancer bids, gets assigned, does work, submits
    await runFreelancerAgent(jobId);

    console.log("\n------------------------------------------------");

    // Phase 3: Verifier checks work, writes attestation, releases USDC
    await runVerifierAgent(jobId);

    console.log("\n================================================");
    console.log("  CYCLE COMPLETE");
    console.log("  Full autonomous agent-to-agent job completed.");
    console.log("  USDC settled on Kite chain.");
    console.log("  Attestation signed by verifier.");
    console.log("  Reputation score updated on-chain.");
    console.log("================================================");

  } catch (err: any) {
    console.error("\nOrchestrator error:", err.message);
    process.exit(1);
  }
}

runFullCycle();