const { ethers } = require("ethers");
require('dotenv').config();

async function main() {
    console.log("🚀 Deploying SuperBridgeL1 to mainnet...");
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log("Wallet address:", wallet.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");
    
    // Contract ABI and bytecode (you'll need to get this from artifacts)
    const contractArtifact = require('./artifacts/contracts/SuperBridgeL1.sol/SuperBridgeL1.json');
    
    // Token address
    const pepuAddress = "0x93aA0ccD1e5628d3A841C4DbdF602D9eb04085d6";
    console.log("📦 PEPU Token:", pepuAddress);
    
    // Create contract factory
    const factory = new ethers.ContractFactory(
        contractArtifact.abi,
        contractArtifact.bytecode,
        wallet
    );
    
    // Deploy with explicit gas settings
    console.log("⏳ Deploying contract...");
    const contract = await factory.deploy(pepuAddress, {
        gasLimit: 2000000,
        gasPrice: ethers.parseUnits("20", "gwei")
    });
    
    console.log("📝 Transaction hash:", contract.deploymentTransaction().hash);
    
    // Wait for deployment
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log("✅ SuperBridgeL1 deployed at:", address);
    
    // Verify deployment
    const token = await contract.TOKEN();
    const version = await contract.getVersion();
    const owner = await contract.owner();
    
    console.log("\n📊 Contract Info:");
    console.log("Token:", token);
    console.log("Version:", version);
    console.log("Owner:", owner);
    
    return address;
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
}); 