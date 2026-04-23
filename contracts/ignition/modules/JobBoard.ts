// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://v2.hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const JobBoardModule = buildModule("JobBoardModule", (m) => {

  const jobBoard = m.contract("JobBoard");

  return { jobBoard };
});

export default JobBoardModule;
