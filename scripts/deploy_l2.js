// deploy_l2.js - Deploy SuperBridgeL2 only
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying SuperBridgeL2...");

    // Deploy L2 bridge
    const SuperBridgeL2 = await ethers.getContractFactory("SuperBridgeL2");
    const l2Bridge = await SuperBridgeL2.deploy();
    await l2Bridge.waitForDeployment();
    const l2Address = await l2Bridge.getAddress();
    
    console.log("✅ SuperBridgeL2 deployed at:", l2Address);
    
    // Get contract info
    const minSignatures = await l2Bridge.MIN_SIGNATURES();
    const numSigners = await l2Bridge.numSigners();
    const version = await l2Bridge.getVersion();
    const owner = await l2Bridge.owner();
    const feeBps = await l2Bridge.FEE_BPS();
    const refundTimeout = await l2Bridge.REFUND_TIMEOUT();
    
    console.log("\n📊 Contract Info:");
    console.log("MIN_SIGNATURES:", minSignatures.toString());
    console.log("numSigners:", numSigners.toString());
    console.log("Version:", version);
    console.log("Owner:", owner);
    console.log("Fee BPS:", feeBps.toString());
    console.log("Refund Timeout:", refundTimeout.toString(), "seconds");
    
    // Check validators
    const validator1 = await l2Bridge.isValidSigner("0x73aF5be3DB46Ce3b7c50Fd833B9C60180f339449");
    console.log("Validator 1 (0x73aF5...):", validator1);
    
    // Check fee exempt
    const feeExempt = await l2Bridge.isFeeExempt("0x17CaBc8001a30800835DD8206CEB0c4bA90B5913");
    console.log("Fee Exempt (0x17CaBc...):", feeExempt);
    
    return l2Address;
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
}); 