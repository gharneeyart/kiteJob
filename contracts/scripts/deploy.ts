import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // 1. Deploy ReputationRegistry (no dependencies)
  console.log("Deploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const registry = await ReputationRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ReputationRegistry deployed to:", registryAddress);

  // 2. Deploy JobBoard (no dependencies)
  console.log("\nDeploying JobBoard...");
  const JobBoard = await ethers.getContractFactory("JobBoard");
  const jobBoard = await JobBoard.deploy();
  await jobBoard.waitForDeployment();
  const jobBoardAddress = await jobBoard.getAddress();
  console.log("JobBoard deployed to:", jobBoardAddress);

  // 3. Deploy Escrow (needs registry address + verifier)
  // For now verifier = deployer, we'll update it when verifier agent is ready
  console.log("\nDeploying Escrow...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(deployer.address, registryAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow deployed to:", escrowAddress);

  // 4. Wire up: tell ReputationRegistry which Escrow can call it
  console.log("\nWiring contracts together...");
  const setEscrowTx = await registry.setEscrowContract(escrowAddress);
  await setEscrowTx.wait();
  console.log("ReputationRegistry now accepts calls from Escrow");

  // 5. Save addresses to a file so agents + frontend can read them
  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    JobBoard: jobBoardAddress,
    Escrow: escrowAddress,
    ReputationRegistry: registryAddress,
    deployedAt: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployments.json");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});