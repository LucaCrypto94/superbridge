// scripts/deploy.js
const hre = require('hardhat');

async function main() {
  const SuperBridge = await hre.ethers.getContractFactory('SuperBridge');
  const superBridge = await SuperBridge.deploy();
  await superBridge.deployed();
  console.log('SuperBridge deployed to:', superBridge.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 