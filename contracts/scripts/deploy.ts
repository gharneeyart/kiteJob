import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Caller:", signer.address);

  const escrowAddress = "0xA41Cb0ab3a02f5D02CC19B3aa325D55CFAd646F8";
  const reputationRegistryAddress = "0xCDbCE1D9aB3d95DaC06Dec7C8Da814944fE10F86";

  if (!escrowAddress) {
    throw new Error("❌ ESCROW_ADDRESS not set in .env");
  }

  const escrow = await ethers.getContractAt(
    "Escrow",
    escrowAddress,
    signer
  );

  const currentVerifier = await escrow.verifier();
  console.log("Current verifier:", currentVerifier);

  const newVerifier = "0xa57686f076BEC43a7F0031aE58325C9ce8187a85";

  const tx = await escrow.setVerifier(newVerifier);
  await tx.wait();

  console.log("✅ Verifier updated to:", newVerifier);

  const registry = await ethers.getContractAt(
    "ReputationRegistry",
    reputationRegistryAddress,
    signer
  );

  const setEscrowTx = await registry.setEscrowContract(escrowAddress);
  await setEscrowTx.wait();

  console.log("✅ ReputationRegistry escrowContract set to:", escrowAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});