import { expect } from "chai";
import { ethers } from "hardhat";
import { JobBoard, Escrow, ReputationRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Freelancer Marketplace", function () {
  let jobBoard: JobBoard;
  let escrow: Escrow;
  let registry: ReputationRegistry;

  let owner: HardhatEthersSigner;
  let client: HardhatEthersSigner;
  let freelancer: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;

  const BOUNTY = ethers.parseEther("0.01"); // 0.01 native token

  beforeEach(async function () {
    [owner, client, freelancer, verifier] = await ethers.getSigners();

    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    registry = await ReputationRegistry.deploy();
    await registry.waitForDeployment();

    const JobBoard = await ethers.getContractFactory("JobBoard");
    jobBoard = await JobBoard.deploy();
    await jobBoard.waitForDeployment();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(verifier.address, await registry.getAddress());
    await escrow.waitForDeployment();

    await registry.setEscrowContract(await escrow.getAddress());
    await registry.connect(freelancer).registerAgent("did:kite:freelancer-001");
  });

  describe("JobBoard", function () {
    it("should post a job", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await jobBoard.connect(client).postJob(
        "Write a smart contract",
        "Build an ERC20 token contract",
        BOUNTY,
        deadline
      );
      const job = await jobBoard.getJob(0);
      expect(job.title).to.equal("Write a smart contract");
      expect(job.client).to.equal(client.address);
      expect(job.status).to.equal(0);
    });

    it("should submit and retrieve a bid", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await jobBoard.connect(client).postJob("Build API", "REST API", BOUNTY, deadline);
      await jobBoard.connect(freelancer).submitBid(0, BOUNTY, "I can do this in 2 hours");
      const bids = await jobBoard.getBids(0);
      expect(bids.length).to.equal(1);
      expect(bids[0].bidder).to.equal(freelancer.address);
    });

    it("should assign job to freelancer", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await jobBoard.connect(client).postJob("Build API", "REST API", BOUNTY, deadline);
      await jobBoard.connect(freelancer).submitBid(0, BOUNTY, "I can do this");
      await jobBoard.connect(client).assignJob(0, freelancer.address);
      const job = await jobBoard.getJob(0);
      expect(job.status).to.equal(1);
      expect(job.assignedTo).to.equal(freelancer.address);
    });

    it("should not allow client to bid on their own job", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await jobBoard.connect(client).postJob("Build API", "REST API", BOUNTY, deadline);
      await expect(
        jobBoard.connect(client).submitBid(0, BOUNTY, "I will do it myself")
      ).to.be.revertedWith("Client cannot bid");
    });

    it("should submit and retrieve deliverable", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await jobBoard.connect(client).postJob("Build API", "REST API", BOUNTY, deadline);
      await jobBoard.connect(freelancer).submitBid(0, BOUNTY, "I can do this");
      await jobBoard.connect(client).assignJob(0, freelancer.address);
      await jobBoard.connect(freelancer).submitDeliverable(0, "https://github.com/freelancer/api");
      const deliverable = await jobBoard.getDeliverable(0);
      expect(deliverable).to.equal("https://github.com/freelancer/api");
    });
  });

  describe("Escrow — fund flow", function () {
    it("should fund escrow with native token", async function () {
      await escrow.connect(client).fundEscrow(0, freelancer.address, { value: BOUNTY });
      const record = await escrow.getEscrow(0);
      expect(record.amount).to.equal(BOUNTY);
      expect(record.client).to.equal(client.address);
      expect(record.freelancer).to.equal(freelancer.address);
      expect(record.status).to.equal(0); // Funded
    });

    it("should not fund same escrow twice", async function () {
      await escrow.connect(client).fundEscrow(0, freelancer.address, { value: BOUNTY });
      await expect(
        escrow.connect(client).fundEscrow(0, freelancer.address, { value: BOUNTY })
      ).to.be.revertedWith("Escrow already exists");
    });

    it("should reject zero value", async function () {
      await expect(
        escrow.connect(client).fundEscrow(0, freelancer.address, { value: 0 })
      ).to.be.revertedWith("Must send native token");
    });
  });

  describe("Escrow — release flow", function () {
    beforeEach(async function () {
      await escrow.connect(client).fundEscrow(0, freelancer.address, { value: BOUNTY });
    });

    it("should release native token to freelancer when verifier approves", async function () {
      const balanceBefore = await ethers.provider.getBalance(freelancer.address);
      await escrow.connect(verifier).releaseEscrow(0);
      const balanceAfter = await ethers.provider.getBalance(freelancer.address);
      expect(balanceAfter - balanceBefore).to.equal(BOUNTY);
      const record = await escrow.getEscrow(0);
      expect(record.status).to.equal(1); // Released
    });

    it("should update reputation after release", async function () {
      await escrow.connect(verifier).releaseEscrow(0);
      const profile = await registry.getProfile(freelancer.address);
      expect(profile.jobsCompleted).to.equal(1n);
      expect(profile.reputationScore).to.equal(110n);
    });

    it("should not allow non-verifier to release", async function () {
      await expect(
        escrow.connect(client).releaseEscrow(0)
      ).to.be.revertedWith("Only verifier can release");
    });

    it("should not release twice", async function () {
      await escrow.connect(verifier).releaseEscrow(0);
      await expect(
        escrow.connect(verifier).releaseEscrow(0)
      ).to.be.revertedWith("Escrow not funded");
    });
  });

  describe("Escrow — refund flow", function () {
    it("should refund client native token on request", async function () {
      await escrow.connect(client).fundEscrow(0, freelancer.address, { value: BOUNTY });
      const balanceBefore = await ethers.provider.getBalance(client.address);
      await escrow.connect(client).refundEscrow(0);
      const balanceAfter = await ethers.provider.getBalance(client.address);
      // balanceAfter > balanceBefore (minus gas)
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });

  describe("ReputationRegistry", function () {
    it("should register an agent with DID", async function () {
      const profile = await registry.getProfile(freelancer.address);
      expect(profile.registered).to.equal(true);
      expect(profile.passportDID).to.equal("did:kite:freelancer-001");
      expect(profile.reputationScore).to.equal(100n);
    });

    it("should not allow duplicate DID registration", async function () {
      await expect(
        registry.connect(client).registerAgent("did:kite:freelancer-001")
      ).to.be.revertedWith("DID already used");
    });
  });
});