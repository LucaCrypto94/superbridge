const { ethers } = require("hardhat");

async function main() {
  const transferId = "0xd5a27cfe6d401723b283ba61601608c5748d930b62c7981bed0ee8f2e4444485";
  const contractAddress = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS;
  
  console.log(`Checking transaction: ${transferId}`);
  console.log(`Contract: ${contractAddress}`);
  
  // Use Pepe L2 RPC
  const provider = new ethers.JsonRpcProvider("https://rpc-pepu-v2-mainnet-0.t.conduit.xyz");
  
  try {
    const contract = new ethers.Contract(contractAddress, [
      "function getTransfer(bytes32 transferId) external view returns (tuple(address user, uint256 originalAmount, uint256 bridgedAmount, uint256 timestamp, uint8 status))",
      "function canRefund(bytes32 transferId) external view returns (bool)",
      "function getRefundTime(bytes32 transferId) external view returns (uint256)"
    ], provider);
    
    // Get transfer details
    const transfer = await contract.getTransfer(transferId);
    console.log("\n📋 Transfer Details:");
    console.log(`User: ${transfer.user}`);
    console.log(`Original Amount: ${ethers.formatEther(transfer.originalAmount)} PEPU`);
    console.log(`Bridged Amount: ${ethers.formatEther(transfer.bridgedAmount)} PEPU`);
    console.log(`Timestamp: ${new Date(Number(transfer.timestamp) * 1000).toLocaleString()}`);
    
    const statusMap = ['Pending', 'Completed', 'Refunded'];
    console.log(`Status: ${statusMap[Number(transfer.status)]}`);
    
    // Check refund eligibility
    const canRefund = await contract.canRefund(transferId);
    const refundTime = await contract.getRefundTime(transferId);
    
    console.log(`\n💰 Refund Info:`);
    console.log(`Can Refund: ${canRefund}`);
    console.log(`Refund Available After: ${new Date(Number(refundTime) * 1000).toLocaleString()}`);
    
    const now = Math.floor(Date.now() / 1000);
    const timeUntilRefund = Number(refundTime) - now;
    
    if (timeUntilRefund > 0) {
      console.log(`⏰ Time Until Refund: ${Math.floor(timeUntilRefund / 60)} minutes`);
    } else {
      console.log(`✅ Refund Available Now!`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.message.includes("execution reverted")) {
      console.log("This transaction ID doesn't exist on this contract");
    }
  }
}

main().catch(console.error);
