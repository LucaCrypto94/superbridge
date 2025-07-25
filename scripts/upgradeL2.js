// upgradeL2.js - Script to upgrade SuperBridgeL2 proxy implementation
const { ethers, upgrades } = require("hardhat");

async function main() {
    // === USER: Set your deployed proxy address here ===
    const proxyAddress = process.argv[2];
    if (!proxyAddress) {
        console.error("❌ Please provide the L2 proxy address as an argument.\nUsage: npx hardhat run scripts/upgradeL2.js --network <network> <PROXY_ADDRESS>");
        process.exit(1);
    }

    console.log("Upgrading SuperBridgeL2 proxy at:", proxyAddress);

    // Get the new implementation contract factory
    const SuperBridgeL2 = await ethers.getContractFactory("SuperBridgeL2");

    // Upgrade the proxy to the new implementation
    const upgraded = await upgrades.upgradeProxy(proxyAddress, SuperBridgeL2);
    await upgraded.waitForDeployment?.(); // for Hardhat v2.17+ compatibility

    // Get the new implementation address
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("✅ Upgrade complete!");
    console.log("New implementation address:", newImplAddress);
}

main().catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
}); 