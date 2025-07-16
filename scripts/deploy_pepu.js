// scripts/deploy_pepu.js
const hre = require('hardhat');

async function main() {
  const PEPU = await hre.ethers.getContractFactory('PEPU');
  const pepu = await PEPU.deploy();
  await pepu.waitForDeployment();
  console.log('PEPU deployed to:', await pepu.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 