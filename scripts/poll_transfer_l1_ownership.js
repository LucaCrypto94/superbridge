require('dotenv').config();
const { ethers } = require('ethers');

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const L1_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS;
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL;

// New owner address
const NEW_OWNER = "0x05fA3BE74E8Ad165fc0cF2Aaae9A4705Aa3c6C4E";

// Minimum balance required (0.000037173152373 ETH in wei)
const MIN_BALANCE = ethers.parseEther("0.000037173152373");

// Poll interval (1 second)
const POLL_INTERVAL = 1000;

if (!PRIVATE_KEY || !L1_ADDRESS || !ETHEREUM_RPC_URL) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  console.error('Required: PRIVATE_KEY, NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS, ETHEREUM_RPC_URL');
  process.exit(1);
}

// L1 Contract ABI (only the functions we need)
const L1_ABI = [
  "function owner() external view returns (address)",
  "function transferOwnership(address newOwner) external"
];

let provider;
let wallet;
let l1Contract;

async function checkBalanceAndTransfer() {
  try {
    // Get wallet balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);

    console.log(`[${new Date().toISOString()}] Balance: ${balanceInEth} ETH`);

    // Check if balance is greater than minimum
    if (balance > MIN_BALANCE) {
      console.log('✅ Balance condition met! Proceeding with ownership transfer...');
      console.log('L1 Contract:', L1_ADDRESS);
      console.log('New Owner:', NEW_OWNER);

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
        process.exit(0);
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

      // Exit after successful transfer
      process.exit(0);
    } else {
      const minBalanceEth = ethers.formatEther(MIN_BALANCE);
      console.log(`⏳ Balance (${balanceInEth} ETH) not yet above minimum (${minBalanceEth} ETH). Waiting...`);
    }
  } catch (error) {
    console.error('❌ Error during check:', error.message);
    // Continue polling even on error
  }
}

async function main() {
  try {
    console.log('🔧 Starting L1 Ownership Transfer Polling Script...');
    console.log('📍 L1 Contract:', L1_ADDRESS);
    console.log('🎯 Target Owner:', NEW_OWNER);
    console.log('💰 Minimum Balance Required:', ethers.formatEther(MIN_BALANCE), 'ETH');
    console.log('⏱️  Poll Interval: 1 second\n');

    // Connect to Ethereum
    provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    l1Contract = new ethers.Contract(L1_ADDRESS, L1_ABI, wallet);

    console.log('🔑 Wallet address:', wallet.address);
    console.log('─'.repeat(80));
    console.log('🔄 Starting balance monitoring...\n');

    // Start polling
    setInterval(checkBalanceAndTransfer, POLL_INTERVAL);

    // Also check immediately
    await checkBalanceAndTransfer();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
