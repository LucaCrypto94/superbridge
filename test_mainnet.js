const { ethers } = require("hardhat");

async function main() {
    console.log("Testing mainnet connection...");
    
    try {
        // Get the provider
        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
        
        // Test connection
        const blockNumber = await provider.getBlockNumber();
        console.log("✅ Connected to mainnet. Current block:", blockNumber);
        
        // Get network info
        const network = await provider.getNetwork();
        console.log("Network chainId:", network.chainId);
        
        // Test wallet
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        console.log("Wallet address:", wallet.address);
        
        // Get balance
        const balance = await provider.getBalance(wallet.address);
        console.log("Balance:", ethers.formatEther(balance), "ETH");
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch(console.error); 