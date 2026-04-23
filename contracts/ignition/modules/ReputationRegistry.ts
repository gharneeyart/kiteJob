import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import JobBoardModule from "./JobBoard";


const ReputationRegistryModule = buildModule("ReputationRegistryModule", (m) => {

  const reputationRegistry = m.contract("ReputationRegistry");

  return { reputationRegistry };
});

export default ReputationRegistryModule;