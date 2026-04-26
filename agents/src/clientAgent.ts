import { ethers } from "ethers";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import {
  provider,
  clientWallet,
  freelancerWallet,
  CONTRACT_ADDRESSES,
  JOB_BOARD_ABI,
  ESCROW_ABI
} from "./config";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const jobBoard = new ethers.Contract(CONTRACT_ADDRESSES.JobBoard, JOB_BOARD_ABI, clientWallet);
const escrow = new ethers.Contract(CONTRACT_ADDRESSES.Escrow, ESCROW_ABI, clientWallet);

async function generateJobDescription(topic: string): Promise<{ title: string; description: string }> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a client agent posting a job on a freelancer marketplace.
        Respond ONLY with valid JSON, no markdown, no backticks:
        {"title": "short job title", "description": "detailed job description in 2-3 sentences"}`
      },
      { role: "user", content: `Create a job posting for: ${topic}` }
    ],
    max_tokens: 200
  });

  const raw = response.choices[0].message.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { title: `Job: ${topic}`, description: `Complete the following task: ${topic}` };
  }
}

export async function runClientAgent(topic: string, bountyETH: number): Promise<number> {
  console.log("\n=== CLIENT AGENT STARTING ===");
  console.log("Wallet:", clientWallet.address);

  const balance = await provider.getBalance(clientWallet.address);
  console.log("Native balance:", ethers.formatEther(balance));

  // Generate job with Groq
  console.log("\nGenerating job description with Groq...");
  const { title, description } = await generateJobDescription(topic);
  console.log("Job title:", title);
  console.log("Description:", description);

  // Post job on-chain
  const deadline = Math.floor(Date.now() / 1000) + 86400;
  const bountyWei = ethers.parseEther(bountyETH.toString());

  console.log("\nPosting job to JobBoard...");
  const postTx = await jobBoard.postJob(title, description, bountyWei, deadline);
  const postReceipt = await postTx.wait();

  const jobPostedEvent = postReceipt.logs
    .map((log: any) => {
      try { return jobBoard.interface.parseLog(log); } catch { return null; }
    })
    .find((e: any) => e?.name === "JobPosted");

  const jobId = Number(jobPostedEvent?.args?.jobId ?? 0n);
  console.log("Job posted! Job ID:", jobId);

  // Fund escrow with native token — no approve needed
  console.log("\nFunding escrow with native token...");
  const fundTx = await escrow.fundEscrow(jobId, freelancerWallet.address, {
    value: bountyWei
  });
  await fundTx.wait();
  console.log("Escrow funded with", bountyETH, "native token");

  console.log("\n=== CLIENT AGENT DONE ===");
  console.log("Job ID:", jobId, "| Bounty:", bountyETH, "| Waiting for bids");

  return jobId;
}