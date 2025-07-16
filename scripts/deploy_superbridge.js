// scripts/deploy_superbridge.js
const hre = require('hardhat');

async function main() {
  const SuperBridge = await hre.ethers.getContractFactory('SuperBridge');
  const superBridge = await SuperBridge.deploy();
  await superBridge.waitForDeployment();
  console.log('SuperBridge deployed to:', await superBridge.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 