// deploy.js - Flexible deployment script
const { ethers, upgrades } = require("hardhat");

// Configuration
const CONFIG = {
    L1: {
        TOKEN_ADDRESS: "0xaFD224042abbd3c51B82C9f43B681014c12649ca",
        UPGRADE_TIMELOCK: 300 // 5 minutes
    },
    L2: {
        UPGRADE_TIMELOCK: 300 // 5 minutes  
    }
};

async function deployL1Only() {
    console.log("🌉 Deploying ONLY SuperBridgeL1 (L1 Payout Contract)...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Deploy L1 proxy system (2 contracts)
    const SuperBridgeL1 = await ethers.getContractFactory("SuperBridgeL1");
    
    console.log("📦 Step 1: Deploying SuperBridgeL1 implementation...");
    console.log("📦 Step 2: Deploying ERC1967Proxy...");
    console.log("📦 Step 3: Linking proxy to implementation...");
    
    const bridgeL1 = await upgrades.deployProxy(
        SuperBridgeL1,
        [CONFIG.L1.TOKEN_ADDRESS, CONFIG.L1.UPGRADE_TIMELOCK],
        { 
            initializer: 'initialize',
            kind: 'uups' 
        }
    );

    await bridgeL1.waitForDeployment();
    const l1ProxyAddress = await bridgeL1.getAddress();
    const l1ImplementationAddress = await upgrades.erc1967.getImplementationAddress(l1ProxyAddress);

    console.log("\n✅ L1 DEPLOYMENT COMPLETE!");
    console.log("=============================");
    console.log("L1 Proxy (USE THIS):", l1ProxyAddress);
    console.log("L1 Implementation:", l1ImplementationAddress);
    console.log("Total contracts deployed: 2");

    return { proxy: l1ProxyAddress, implementation: l1ImplementationAddress };
}

async function deployL2Only() {
    console.log("🌉 Deploying ONLY SuperBridgeL2 (L2 Bridge Contract)...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Deploy L2 proxy system (2 contracts)
    const SuperBridgeL2 = await ethers.getContractFactory("SuperBridgeL2");
    
    console.log("📦 Step 1: Deploying SuperBridgeL2 implementation...");
    console.log("📦 Step 2: Deploying ERC1967Proxy...");
    console.log("📦 Step 3: Linking proxy to implementation...");
    
    const bridgeL2 = await upgrades.deployProxy(
        SuperBridgeL2,
        [deployer.address, CONFIG.L2.UPGRADE_TIMELOCK], // deployer = fee recipient
        { 
            initializer: 'initialize',
            kind: 'uups' 
        }
    );

    await bridgeL2.waitForDeployment();
    const l2ProxyAddress = await bridgeL2.getAddress();
    const l2ImplementationAddress = await upgrades.erc1967.getImplementationAddress(l2ProxyAddress);

    console.log("\n✅ L2 DEPLOYMENT COMPLETE!");
    console.log("=============================");
    console.log("L2 Proxy (USE THIS):", l2ProxyAddress);
    console.log("L2 Implementation:", l2ImplementationAddress);
    console.log("Total contracts deployed: 2");

    return { proxy: l2ProxyAddress, implementation: l2ImplementationAddress };
}

async function deployBoth() {
    console.log("🚀 Deploying BOTH L1 and L2 Bridge Systems...");
    console.log("===============================================\n");
    
    // Deploy L1 first
    const l1Result = await deployL1Only();
    
    console.log("\n" + "=".repeat(50) + "\n");
    
    // Deploy L2 second
    const l2Result = await deployL2Only();

    console.log("\n🎉 COMPLETE BRIDGE SYSTEM DEPLOYED!");
    console.log("=====================================");
    console.log("L1 Proxy (USE THIS):", l1Result.proxy);
    console.log("L1 Implementation:", l1Result.implementation);
    console.log("L2 Proxy (USE THIS):", l2Result.proxy);
    console.log("L2 Implementation:", l2Result.implementation);
    console.log("Total contracts deployed: 4");
    console.log("=====================================");

    return {
        l1: l1Result,
        l2: l2Result
    };
}

// Main function - choose what to deploy based on command line args
async function main() {
    const args = process.argv.slice(2);
    const deployType = args[0] || "both"; // default to both

    console.log(`🎯 Deploy Type: ${deployType}\n`);

    switch (deployType.toLowerCase()) {
        case "l1":
        case "l1-only":
            return await deployL1Only();
            
        case "l2": 
        case "l2-only":
            return await deployL2Only();
            
        case "both":
        case "all":
        default:
            return await deployBoth();
    }
}

// Export functions for use in other scripts
module.exports = {
    deployL1Only,
    deployL2Only,
    deployBoth,
    main
};

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}