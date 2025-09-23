require('dotenv').config();
const { ethers } = require('ethers');

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const L1_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS;
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL;

// New owner address
const NEW_OWNER = "cc";

if (!PRIVATE_KEY || !L1_ADDRESS || !ETHEREUM_RPC_URL) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  console.error('Required: PRIVATE_KEY, NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS, ETHEREUM_RPC_URL');
  process.exit(1);
}

// L1 Contract ABI (only the functions we need)
const L1_ABI = [
  "function owner() external view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function renounceOwnership() external"
];

async function main() {
  try {
    console.log('🔧 Transferring L1 Contract Ownership...');
    console.log('L1 Contract:', L1_ADDRESS);
    console.log('New Owner:', NEW_OWNER);
    
    // Connect to Ethereum
    const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const l1Contract = new ethers.Contract(L1_ADDRESS, L1_ABI, wallet);
    
    console.log('🔑 Current wallet address:', wallet.address);
    
    // Check current owner
    const currentOwner = await l1Contract.owner();
    console.log('👤 Current owner:', currentOwner);
    
    if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error('❌ Error: Current wallet is not the owner of the contract');
      console.error('Expected owner:', wallet.address);
      console.error('Actual owner:', currentOwner);
      process.exit(1);
    }
    
    if (currentOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
      console.log('✅ Contract is already owned by the target address');
      return;
    }
    
    // Transfer ownership
    console.log('📝 Transferring ownership...');
    const tx = await l1Contract.transferOwnership(NEW_OWNER);
    console.log('⏳ Transaction hash:', tx.hash);
    
    console.log('⏳ Waiting for confirmation...');
    await tx.wait();
    
    // Verify transfer
    const newOwner = await l1Contract.owner();
    console.log('✅ Ownership transferred successfully!');
    console.log('👤 New owner:', newOwner);
    
    if (newOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
      console.log('🎉 Transfer confirmed!');
    } else {
      console.error('❌ Transfer verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error transferring ownership:', error);
    process.exit(1);
  }
}

main().catch(console.error);



