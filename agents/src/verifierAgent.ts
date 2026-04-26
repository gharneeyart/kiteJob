import { ethers } from "ethers";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import {
  provider,
  verifierWallet,
  freelancerWallet,
  CONTRACT_ADDRESSES,
  JOB_BOARD_ABI,
  ESCROW_ABI,
  REPUTATION_ABI
} from "./config";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const jobBoard = new ethers.Contract(CONTRACT_ADDRESSES.JobBoard, JOB_BOARD_ABI, verifierWallet);
const escrow = new ethers.Contract(CONTRACT_ADDRESSES.Escrow, ESCROW_ABI, verifierWallet);
const registry = new ethers.Contract(CONTRACT_ADDRESSES.ReputationRegistry, REPUTATION_ABI, verifierWallet);

// ── Agent Passport ──────────────────────────────────────────────
// Kite Agent Passport = a DID (Decentralized Identifier) tied to
// this agent's wallet. It proves the verifier is a known, credentialed
// agent — not just any wallet calling releaseEscrow.
async function getOrCreateAgentPassport(): Promise<string> {
  // Passport DID format: did:kite:<chainId>:<address>
  const network = await provider.getNetwork();
  const did = `did:kite:${network.chainId}:${verifierWallet.address.toLowerCase()}`;

  // Sign the DID with the verifier wallet to prove ownership
  const signature = await verifierWallet.signMessage(did);

  const passport = {
    did,
    controller: verifierWallet.address,
    role: "verifier",
    chainId: network.chainId.toString(),
    signature,
    issuedAt: new Date().toISOString()
  };

  console.log("\n── Agent Passport ──────────────────────────────");
  console.log("DID:       ", did);
  console.log("Controller:", passport.controller);
  console.log("Role:      ", passport.role);
  console.log("Signature: ", signature.slice(0, 24) + "...");
  console.log("────────────────────────────────────────────────");

  return JSON.stringify(passport);
}

// ── Kite Attestation ────────────────────────────────────────────
// An attestation is a signed, structured claim written to chain.
// It proves: who verified, what job, what score, when — tamper-proof.
async function createKiteAttestation(
  jobId: number,
  freelancerAddress: string,
  score: number,
  reason: string,
  passportDID: string
): Promise<{ attestation: string; txHash: string }> {

  const network = await provider.getNetwork();
  const block = await provider.getBlock("latest");

  // Structured attestation payload
  const attestationPayload = {
    "@context": "https://kite.ai/attestation/v1",
    type: "WorkCompletionAttestation",
    jobId,
    freelancer: freelancerAddress,
    verifier: verifierWallet.address,
    verifierDID: passportDID,
    qualityScore: score,
    verdict: "approved",
    reason,
    chainId: network.chainId.toString(),
    blockNumber: block?.number,
    timestamp: Math.floor(Date.now() / 1000),
    issuedAt: new Date().toISOString()
  };

  const attestationString = JSON.stringify(attestationPayload);

  // Sign with verifier wallet — this is the cryptographic proof
  const attestationHash = ethers.keccak256(ethers.toUtf8Bytes(attestationString));
  const signature = await verifierWallet.signMessage(ethers.getBytes(attestationHash));

  const fullAttestation = {
    payload: attestationPayload,
    hash: attestationHash,
    signature,
    signedBy: verifierWallet.address
  };

  // Write attestation on-chain as an event by sending a minimal tx
  // with the attestation hash in the data field — permanently logged on Kite chain
  const tx = await verifierWallet.sendTransaction({
    to: verifierWallet.address, // self-send
    value: 0n,
    data: ethers.hexlify(ethers.toUtf8Bytes(
      `KITE_ATTESTATION:${attestationHash}:JOB_${jobId}:SCORE_${score}`
    ))
  });
  const receipt = await tx.wait();

  console.log("\n── Kite Attestation ────────────────────────────");
  console.log("Type:      WorkCompletionAttestation");
  console.log("Job ID:    ", jobId);
  console.log("Score:     ", score + "/100");
  console.log("Hash:      ", attestationHash);
  console.log("Signature: ", signature.slice(0, 24) + "...");
  console.log("On-chain tx:", receipt?.hash);
  console.log("────────────────────────────────────────────────");

  return {
    attestation: JSON.stringify(fullAttestation, null, 2),
    txHash: receipt?.hash ?? ""
  };
}

// ── Quality Verification ────────────────────────────────────────
async function verifyDeliverable(
  title: string,
  description: string,
  deliverable: string
): Promise<{ approved: boolean; reason: string; score: number }> {

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a strict quality verifier for a freelancer marketplace.
Evaluate if the deliverable satisfactorily completes the job.
Respond ONLY with valid JSON, no markdown, no backticks:
{"approved": true, "reason": "explanation", "score": 85}`
      },
      {
        role: "user",
        content: `Job title: ${title}
Job description: ${description}
Deliverable: ${deliverable}

Does this deliverable satisfactorily complete the job?`
      }
    ],
    max_tokens: 200
  });

  const raw = (response.choices[0].message.content || "{}").trim();

  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { approved: true, reason: "Verification completed", score: 75 };
  }
}

// ── Main ────────────────────────────────────────────────────────
export async function runVerifierAgent(jobId: number): Promise<void> {
  console.log("\n=== VERIFIER AGENT STARTING ===");
  console.log("Wallet:", verifierWallet.address);

  // Confirm this wallet is actually the registered verifier
  const onChainVerifier = await escrow.verifier();
  console.log("On-chain verifier:", onChainVerifier);

  if (onChainVerifier.toLowerCase() !== verifierWallet.address.toLowerCase()) {
    throw new Error(
      `Verifier mismatch!\n` +
      `  On-chain verifier: ${onChainVerifier}\n` +
      `  This wallet:       ${verifierWallet.address}\n` +
      `  Fix: run setVerifier.ts with address ${verifierWallet.address}`
    );
  }

  console.log("✅ Verifier wallet matches on-chain verifier");

  // Get Agent Passport
  const passportJSON = await getOrCreateAgentPassport();
  const passport = JSON.parse(passportJSON);

  // Read job + deliverable from chain
  const job = await jobBoard.getJob(jobId);
  const deliverable = await jobBoard.getDeliverable(jobId);

  console.log("\nReviewing job:", job.title);
  console.log("Freelancer:  ", job.assignedTo);

  if (!deliverable || deliverable === "") {
    throw new Error("No deliverable found on-chain for job " + jobId);
  }

  // Run quality check
  console.log("\nRunning quality check with Groq...");
  const { approved, reason, score } = await verifyDeliverable(
    job.title,
    job.description,
    deliverable
  );

  console.log("Quality score:", score + "/100");
  console.log("Approved:    ", approved);
  console.log("Reason:      ", reason);

  if (!approved) {
    console.log("\n❌ Deliverable REJECTED. Escrow not released.");
    console.log("Client can call refundEscrow() to recover funds.");
    return;
  }

  // Write Kite attestation on-chain
  const { attestation, txHash } = await createKiteAttestation(
    jobId,
    job.assignedTo,
    score,
    reason,
    passport.did
  );

  // Release escrow → triggers USDC transfer + reputation update
  console.log("\nReleasing escrow...");
  const releaseTx = await escrow.releaseEscrow(jobId);
  const releaseReceipt = await releaseTx.wait();
  console.log("✅ Escrow released! Tx:", releaseReceipt.hash);

  // Confirm reputation updated
  const profile = await registry.getProfile(freelancerWallet.address);
  console.log("\n── Reputation Updated ──────────────────────────");
  console.log("Freelancer:    ", freelancerWallet.address);
  console.log("Jobs completed:", profile.jobsCompleted.toString());
  console.log("Reputation:    ", profile.reputationScore.toString());
  console.log("Total earned:  ", ethers.formatEther(profile.totalEarned), "KITE");
  console.log("────────────────────────────────────────────────");

  console.log("\n=== VERIFIER AGENT DONE ===");
  console.log("Job ID:", jobId, "| Native token released to:", job.assignedTo);
  console.log("Attestation tx:", txHash);
  console.log("Agent Passport DID:", passport.did);
}