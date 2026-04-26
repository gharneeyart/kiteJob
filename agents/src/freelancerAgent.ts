import { ethers } from "ethers";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import {
  freelancerWallet,
  clientWallet,
  CONTRACT_ADDRESSES,
  JOB_BOARD_ABI
} from "./config";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const jobBoardAsFreelancer = new ethers.Contract(CONTRACT_ADDRESSES.JobBoard, JOB_BOARD_ABI, freelancerWallet);
const jobBoardAsClient = new ethers.Contract(CONTRACT_ADDRESSES.JobBoard, JOB_BOARD_ABI, clientWallet);

async function doWork(title: string, description: string): Promise<string> {
  console.log("\nWorking on task with Groq...");
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a skilled freelancer agent. Complete the task given to you.
        CRITICAL: If the task specifies a word count, you MUST stay within that limit.
        Count your words before responding. Be professional and concise.`
      },
      {
        role: "user",
        content: `Job title: ${title}\n\nJob description: ${description}\n\nComplete this task now.`
      }
    ],
    max_tokens: 500
  });

  return response.choices[0].message.content || "Task completed.";
}

async function writeBidProposal(title: string, description: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are a freelancer writing a short bid proposal. Keep it under 50 words. Be confident and specific."
      },
      {
        role: "user",
        content: `Write a bid for this job: ${title} — ${description}`
      }
    ],
    max_tokens: 100
  });

  return response.choices[0].message.content || "I can complete this task efficiently.";
}

export async function runFreelancerAgent(jobId: number): Promise<void> {
  console.log("\n=== FREELANCER AGENT STARTING ===");
  console.log("Wallet:", freelancerWallet.address);

  // Read job from chain
  const job = await jobBoardAsFreelancer.getJob(jobId);
  console.log("\nJob found on-chain:");
  console.log("Title:", job.title);
  console.log("Description:", job.description);
  console.log("Bounty:", ethers.formatEther(job.bounty), "KITE");

  // Generate and submit bid
  console.log("\nGenerating bid proposal...");
  const proposal = await writeBidProposal(job.title, job.description);
  console.log("Proposal:", proposal);

  const bidTx = await jobBoardAsFreelancer.submitBid(jobId, job.bounty, proposal);
  await bidTx.wait();
  console.log("Bid submitted on-chain");

  // Client agent auto-assigns (in real flow this would wait for client)
  console.log("\nClient assigning job to freelancer...");
  const assignTx = await jobBoardAsClient.assignJob(jobId, freelancerWallet.address);
  await assignTx.wait();
  console.log("Job assigned to freelancer:", freelancerWallet.address);

  // Do the actual work
  const deliverable = await doWork(job.title, job.description);
  console.log("\nWork completed. Deliverable preview:");
  console.log(deliverable.slice(0, 200) + "...");

  // Submit deliverable on-chain
  console.log("\nSubmitting deliverable on-chain...");
  const deliverTx = await jobBoardAsFreelancer.submitDeliverable(jobId, deliverable);
  await deliverTx.wait();
  console.log("Deliverable submitted on-chain");

  console.log("\n=== FREELANCER AGENT DONE ===");
  console.log("Job ID:", jobId, "| Deliverable submitted | Waiting for verification");
}