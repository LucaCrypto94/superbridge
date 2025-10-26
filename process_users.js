require('dotenv').config();
const { ethers } = require('ethers');

// Load environment variables
const SIGNER_KEY = process.env.SIGNER_KEY;
const L2_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS;
const RPC_URL = "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";

// Contract ABI
const L2_ABI = [
  "event BridgeInitiated(address indexed user, uint256 originalAmount, uint256 bridgedAmount, bytes32 transferId, uint256 timestamp)",
  "function getTransfer(bytes32 transferId) external view returns (tuple(address user, uint256 originalAmount, uint256 bridgedAmount, uint256 timestamp, uint8 status))",
  "function complete(bytes32 transferId, bytes[] calldata signatures, address[] calldata signers) external"
];

// Status enum mapping
const STATUS = {
  0: 'Pending',
  1: 'Completed', 
  2: 'Refunded',
};

// ===========================================
// CONFIGURATION - ADD/REMOVE ADDRESSES HERE
// ===========================================
const USER_ADDRESSES = [
  "0x1810913eD824a7930f48AeA51AaF480B2dEFdfeb",
  "0x972cdcC8768Edc948Bf81247E97104b66b59F62a",
  "0x29FB4dc354d910e2efC23f3ECFe6781327994620",
  "0x0005474458B31A71311B9f88C1B6a65612C0a5Fa",
  "0x5CB8D5b4a5f6B58D0dE49093158D913Ef5bfc4A6"
];

// Addresses we've already processed (to avoid duplicates) - CLEARED
const PROCESSED_ADDRESSES = [
  // Cleared for fresh processing
];

// Filter out already processed addresses
const UNIQUE_USERS = USER_ADDRESSES.filter(addr => !PROCESSED_ADDRESSES.includes(addr));

async function signMessage(transferId, user, bridgedAmount, contractAddress) {
  try {
    // Create the message hash that the contract expects
    const rawHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'address', 'uint256', 'address'],
      [transferId, user, bridgedAmount, contractAddress]
    ));
    
    // Sign the raw hash directly using getBytes
    const signer = new ethers.Wallet(SIGNER_KEY);
    const signature = await signer.signMessage(ethers.getBytes(rawHash));
    
    console.log('✅ Signature created');
    return signature;
  } catch (err) {
    console.error('❌ Error signing:', err.message);
    throw err;
  }
}

async function completeTransaction(transferId, user, bridgedAmount, signature) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(SIGNER_KEY, provider);
    
    const contract = new ethers.Contract(L2_ADDRESS, L2_ABI, wallet);
    
    console.log('🔍 Calling complete...');
    console.log('Signer address:', wallet.address);
    const tx = await contract.complete(transferId, [signature], [wallet.address]);
    console.log('📝 TX sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Completed in block:', receipt.blockNumber);
    
    return receipt;
  } catch (err) {
    console.error('❌ Error completing:', err.message);
    throw err;
  }
}

async function getUserTransactions(userAddress) {
  try {
    console.log(`\n🔍 Getting transactions for user: ${userAddress}`);
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(L2_ADDRESS, L2_ABI, provider);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    
    // Query last 50000 blocks for BridgeInitiated events
    const fromBlock = Math.max(0, currentBlock - 50000);
    
    // Get all BridgeInitiated events for this user
    const filter = contract.filters.BridgeInitiated(userAddress);
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} transactions`);
    
    if (events.length === 0) {
      console.log('No transactions found');
      return { completed: 0, alreadyFinalized: 0, totalAmount: 0 };
    }
    
    let completed = 0;
    let alreadyFinalized = 0;
    let totalAmount = 0;
    
    // Process each transaction
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const transferId = event.args.transferId;
      const user = event.args.user;
      const bridgedAmount = event.args.bridgedAmount;
      const originalAmount = event.args.originalAmount;
      
      console.log(`\n--- Transaction ${i + 1}/${events.length} ---`);
      console.log('Transfer ID:', transferId);
      console.log('User:', user);
      console.log('Original Amount:', ethers.formatEther(originalAmount), 'PEPU');
      console.log('Bridged Amount:', ethers.formatEther(bridgedAmount), 'PEPU');
      console.log('Block:', event.blockNumber);
      
      try {
        // Check current status
        const transferData = await contract.getTransfer(transferId);
        console.log('Status:', STATUS[transferData.status] || 'Unknown');
        
        // Skip if already completed or refunded
        if (transferData.status === 1) { // Completed
          console.log('⏭️  Already completed, skipping...');
          alreadyFinalized++;
          totalAmount += parseFloat(ethers.formatEther(bridgedAmount));
          continue;
        }
        
        if (transferData.status === 2) { // Refunded
          console.log('⏭️  Already refunded, skipping...');
          alreadyFinalized++;
          continue;
        }
        
        // Create signature and complete
        console.log('🔍 Creating signature...');
        const signature = await signMessage(transferId, user, bridgedAmount, L2_ADDRESS);
        
        console.log('🔍 Completing transaction...');
        const receipt = await completeTransaction(transferId, user, bridgedAmount, signature);
        
        console.log('✅ Transaction completed successfully!');
        console.log('Complete TX Hash:', receipt.transactionHash);
        
        completed++;
        totalAmount += parseFloat(ethers.formatEther(bridgedAmount));
        
        // Wait a bit before next transaction
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (err) {
        console.error(`❌ Error processing transaction ${transferId}:`, err.message);
        if (err.message.includes('0x475a2535')) {
          console.log('⏭️  Already finalized (expected error)');
          alreadyFinalized++;
          totalAmount += parseFloat(ethers.formatEther(bridgedAmount));
        }
        continue;
      }
    }
    
    return { completed, alreadyFinalized, totalAmount };
    
  } catch (err) {
    console.error('❌ Error:', err);
    return { completed: 0, alreadyFinalized: 0, totalAmount: 0 };
  }
}

async function processAllUsers() {
  console.log('🚀 Starting batch processing...');
  console.log(`📋 Total addresses in config: ${USER_ADDRESSES.length}`);
  console.log(`🚫 Already processed: ${PROCESSED_ADDRESSES.length}`);
  console.log(`✅ New addresses to process: ${UNIQUE_USERS.length}`);
  
  if (UNIQUE_USERS.length === 0) {
    console.log('⚠️  No new addresses to process! All addresses have been processed before.');
    return;
  }
  
  let totalCompleted = 0;
  let totalAlreadyFinalized = 0;
  let grandTotalAmount = 0;
  
  for (let i = 0; i < UNIQUE_USERS.length; i++) {
    const userAddress = UNIQUE_USERS[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing User ${i + 1}/${UNIQUE_USERS.length}: ${userAddress}`);
    console.log(`${'='.repeat(60)}`);
    
    const result = await getUserTransactions(userAddress);
    
    totalCompleted += result.completed;
    totalAlreadyFinalized += result.alreadyFinalized;
    grandTotalAmount += result.totalAmount;
    
    console.log(`\n📊 User Summary:`);
    console.log(`✅ Completed: ${result.completed}`);
    console.log(`⏭️  Already Finalized: ${result.alreadyFinalized}`);
    console.log(`💰 Total Amount: ${result.totalAmount.toFixed(2)} PEPU`);
    
    // Wait between users
    if (i < UNIQUE_USERS.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before next user...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 FINAL SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`👥 Users Processed: ${UNIQUE_USERS.length}`);
  console.log(`✅ Total Completed: ${totalCompleted}`);
  console.log(`⏭️  Total Already Finalized: ${totalAlreadyFinalized}`);
  console.log(`💰 Grand Total Amount: ${grandTotalAmount.toFixed(2)} PEPU`);
  console.log(`${'='.repeat(60)}`);
}

// Run the script
processAllUsers();
