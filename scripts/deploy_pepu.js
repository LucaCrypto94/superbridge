// deploy_pepu.js - Deploy PEPU token only
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying PEPU token...");

    // Deploy PEPU token
    const PEPU = await ethers.getContractFactory("PEPU");
    const pepu = await PEPU.deploy();
    await pepu.waitForDeployment();
    const pepuAddress = await pepu.getAddress();
    
    console.log("✅ PEPU deployed at:", pepuAddress);
    
    // Get token info
    const name = await pepu.name();
    const symbol = await pepu.symbol();
    const decimals = await pepu.decimals();
    const totalSupply = await pepu.totalSupply();
    
    console.log("\n📊 Token Info:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals.toString());
    console.log("Total Supply:", ethers.formatEther(totalSupply));
    
    return pepuAddress;
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
}); 