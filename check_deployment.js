const { ethers } = require("ethers");
require('dotenv').config();

const TX_HASH = "0x869e81e9e7d48c0b952bb1197d82363a84678323913f77cbc972972ed4f9ca69";

async function checkDeployment() {
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    
    console.log("🔍 Checking deployment status...");
    console.log("Transaction Hash:", TX_HASH);
    
    try {
        // Check transaction receipt
        const receipt = await provider.getTransactionReceipt(TX_HASH);
        
        if (!receipt) {
            console.log("⏳ Transaction still pending...");
            
            // Get transaction details
            const tx = await provider.getTransaction(TX_HASH);
            if (tx) {
                console.log("Gas Price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
                console.log("Gas Limit:", tx.gasLimit.toString());
            }
            
            // Check current gas price
            const feeData = await provider.getFeeData();
            console.log("Current network gas price:", ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");
            
            return;
        }
        
        if (receipt.status === 1) {
            console.log("✅ Deployment successful!");
            console.log("Contract Address:", receipt.contractAddress);
            console.log("Gas Used:", receipt.gasUsed.toString());
            console.log("Block Number:", receipt.blockNumber);
            
            // Verify the contract
            const contract = new ethers.Contract(
                receipt.contractAddress,
                ["function TOKEN() view returns (address)", "function getVersion() view returns (string)"],
                provider
            );
            
            try {
                const token = await contract.TOKEN();
                const version = await contract.getVersion();
                console.log("Token Address:", token);
                console.log("Version:", version);
            } catch (err) {
                console.log("Could not verify contract functions:", err.message);
            }
            
        } else {
            console.log("❌ Deployment failed!");
            console.log("Gas Used:", receipt.gasUsed.toString());
        }
        
    } catch (error) {
        console.error("Error checking deployment:", error.message);
    }
}

// Check every 30 seconds
checkDeployment();
setInterval(checkDeployment, 30000); 