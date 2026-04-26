import * as dotenv from "dotenv";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

dotenv.config();


// Provider + signers
export const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL);

export const clientWallet = new ethers.Wallet(process.env.CLIENT_PRIVATE_KEY!, provider);
export const freelancerWallet = new ethers.Wallet(process.env.FREELANCER_PRIVATE_KEY!, provider);
export const verifierWallet = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY!, provider);

// Contract addresses from deploy
export const CONTRACT_ADDRESSES = {
  JobBoard: "0xe1b1a7cb7C0D3bb12ACB7a725eD60D8d393eF788",
  Escrow: "0xA41Cb0ab3a02f5D02CC19B3aa325D55CFAd646F8",
  ReputationRegistry: "0xCDbCE1D9aB3d95DaC06Dec7C8Da814944fE10F86",
};


// ABIs — only the functions we need
export const JOB_BOARD_ABI = [
  "function postJob(string title, string description, uint256 bounty, uint256 deadline) external returns (uint256)",
  "function submitBid(uint256 jobId, uint256 price, string proposal) external",
  "function assignJob(uint256 jobId, address freelancer) external",
  "function submitDeliverable(uint256 jobId, string deliverable) external",
  "function markCompleted(uint256 jobId) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, string title, string description, uint256 bounty, uint8 status, address assignedTo, uint256 createdAt, uint256 deadline))",
  "function getBids(uint256 jobId) external view returns (tuple(address bidder, uint256 price, string proposal, uint256 submittedAt)[])",
  "function getDeliverable(uint256 jobId) external view returns (string)",
  "function jobCounter() external view returns (uint256)",
  "event JobPosted(uint256 indexed jobId, address indexed client, string title, uint256 bounty)",
  "event BidSubmitted(uint256 indexed jobId, address indexed bidder, uint256 price)",
  "event JobAssigned(uint256 indexed jobId, address indexed freelancer)",
  "event DeliverableSubmitted(uint256 indexed jobId, address indexed freelancer, string deliverable)"
];

export const ESCROW_ABI = [
  "function fundEscrow(uint256 jobId, address freelancer) payable external",
  "function releaseEscrow(uint256 jobId) external",
  "function refundEscrow(uint256 jobId) external",
  "function getEscrow(uint256 jobId) external view returns (tuple(uint256 jobId, address client, address freelancer, uint256 amount, uint8 status))",
  "function verifier() external view returns (address)" 
];

export const REPUTATION_ABI = [
  "function registerAgent(string passportDID) external",
  "function getProfile(address agent) external view returns (tuple(address agent, string passportDID, uint256 jobsCompleted, uint256 totalEarned, uint256 reputationScore, bool registered))"
];