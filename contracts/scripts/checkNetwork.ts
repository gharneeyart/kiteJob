import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  const balance = await provider.getBalance(deployer.address);

  console.log("Network name:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deployer address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});