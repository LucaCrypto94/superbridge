// test_deploy.js - Simple test deployment
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Testing deployment...");
    
    try {
        // Test if we can get the network
        const network = await ethers.provider.getNetwork();
        console.log("Network:", network.name, "Chain ID:", network.chainId);
        
        // Test if we can get the signer
        const [signer] = await ethers.getSigners();
        console.log("Signer:", signer.address);
        console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)));
        
        // Try to deploy a simple contract
        console.log("Deploying test contract...");
        const TestContract = await ethers.getContractFactory("SuperBridgeL1");
        const testContract = await TestContract.deploy("0xaFD224042abbd3c51B82C9f43B681014c12649ca");
        await testContract.waitForDeployment();
        
        const address = await testContract.getAddress();
        console.log("✅ Test contract deployed at:", address);
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
}); 