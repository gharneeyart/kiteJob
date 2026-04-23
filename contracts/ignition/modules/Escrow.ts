import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const EscrowModule = buildModule("EscrowModule", (m) => {

  const escrow = m.contract("Escrow", ["0xD1080228bE7028A61D6288de3D4Bbe04a088bc97", "0xCDbCE1D9aB3d95DaC06Dec7C8Da814944fE10F86"]);

  return { escrow };
});

export default EscrowModule;
