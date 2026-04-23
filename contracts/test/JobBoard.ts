import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("JobBoard", function () {
  async function deployJobBoard() {

    const [owner, otherAccount] = await hre.ethers.getSigners();

    const JobBoard = await hre.ethers.getContractFactory("JobBoard");
    const jobBoard = await JobBoard.deploy();

    return { jobBoard, owner, otherAccount };
  }

  describe("deployment", function() {
    it("Should post job", async function(){
        const {owner, jobBoard} = await loadFixture(deployJobBoard);
        const job = jobBoard.postJob("Frontend Engineer", "Looking for a skilled frontend developer", 1000, 1700000000);
        expect(job).to.emit(jobBoard, "JobPosted").withArgs(0, owner.address, "Frontend Engineer", 1000);
        
    })
  })
});