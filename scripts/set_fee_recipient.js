require('dotenv').config();
const { ethers } = require('ethers');

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const L2_ADDRESS = "0x9F2091C509141c112F94fF879FF6150f9034A4aa"; // Newly deployed contract
const PEPU_MAINNET_RPC = "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";

// The funds recipient address (where bridged funds go)
const FUNDS_RECIPIENT = "0x23d26298248FFCc71f49849fA0beB8e30A2bdE6C";

if (!PRIVATE_KEY || !L2_ADDRESS) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  console.error('Required: PRIVATE_KEY, NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS');
  process.exit(1);
}

// L2 Contract ABI (only the functions we need)
const L2_ABI = [
  "function feeRecipient() external view returns (address)",
  "function setFeeRecipient(address _feeRecipient) external",
  "function owner() external view returns (address)"
];

async function main() {
  try {
    console.log('🔧 Setting Fee Recipient...');
    console.log('L2 Contract:', L2_ADDRESS);
    console.log('Fee Recipient:', FUNDS_RECIPIENT);
    
    // Connect to Pepe Unchained V2
    const provider = new ethers.JsonRpcProvider(PEPU_MAINNET_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const l2Contract = new ethers.Contract(L2_ADDRESS, L2_ABI, wallet);
    
    console.log('🔑 Wallet address:', wallet.address);
    
    // Check current owner
    const currentOwner = await l2Contract.owner();
    console.log('👤 Contract owner:', currentOwner);
    
    if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error('❌ Error: Current wallet is not the owner of the contract');
      console.error('Expected owner:', wallet.address);
      console.error('Actual owner:', currentOwner);
      process.exit(1);
    }
    
    // Check current fee recipient
    const currentFeeRecipient = await l2Contract.feeRecipient();
    console.log('💰 Current fee recipient:', currentFeeRecipient);
    
    if (currentFeeRecipient.toLowerCase() === FUNDS_RECIPIENT.toLowerCase()) {
      console.log('✅ Fee recipient is already set to the funds recipient');
      return;
    }
    
    // Set fee recipient
    console.log('📝 Setting fee recipient...');
    const tx = await l2Contract.setFeeRecipient(FUNDS_RECIPIENT);
    console.log('⏳ Transaction hash:', tx.hash);
    
    console.log('⏳ Waiting for confirmation...');
    await tx.wait();
    
    // Verify the change
    const newFeeRecipient = await l2Contract.feeRecipient();
    console.log('✅ Fee recipient updated successfully!');
    console.log('💰 New fee recipient:', newFeeRecipient);
    
    if (newFeeRecipient.toLowerCase() === FUNDS_RECIPIENT.toLowerCase()) {
      console.log('🎉 Fee recipient set correctly!');
      console.log('💡 Now fees will go to the same address as bridged funds');
    } else {
      console.error('❌ Fee recipient verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error setting fee recipient:', error);
    process.exit(1);
  }
}

main().catch(console.error);
