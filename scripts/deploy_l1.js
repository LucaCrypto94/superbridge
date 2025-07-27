// deploy_l1.js - Deploy SuperBridgeL1 only
const { ethers } = require("hardhat");

async function main() {
    // Hardcode the PEPU address for now
    const pepuAddress = "0xaFD224042abbd3c51B82C9f43B681014c12649ca";
    
    console.log("🚀 Deploying SuperBridgeL1...");
    console.log("📦 PEPU Token:", pepuAddress);
    console.log("📦 PEPU Token:", pepuAddress);

    // Deploy L1 bridge
    const SuperBridgeL1 = await ethers.getContractFactory("SuperBridgeL1");
    const l1Bridge = await SuperBridgeL1.deploy(pepuAddress);
    await l1Bridge.waitForDeployment();
    const l1Address = await l1Bridge.getAddress();
    
    console.log("✅ SuperBridgeL1 deployed at:", l1Address);
    
    // Get contract info
    const token = await l1Bridge.TOKEN();
    const version = await l1Bridge.getVersion();
    const owner = await l1Bridge.owner();
    const balance = await l1Bridge.getBalance();
    
    console.log("\n📊 Contract Info:");
    console.log("Token:", token);
    console.log("Version:", version);
    console.log("Owner:", owner);
    console.log("Token Balance:", ethers.formatEther(balance));
    
    return l1Address;
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
}); 