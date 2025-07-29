require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
  console.log('💰 Emergency Token Withdraw from L1 Contract...\n');

  // Get private key from .env
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  // L1 Contract address from .env
  const L1_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS;
  if (!L1_ADDRESS) {
    console.error('❌ NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS not found in .env file');
    process.exit(1);
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('🔑 Wallet Address:', wallet.address);
  console.log('📋 L1 Contract:', L1_ADDRESS);
  console.log('');

  // L1 Contract ABI for emergency withdraw
  const L1_ABI = [
    "function TOKEN() external view returns (address)",
    "function getBalance() external view returns (uint256)",
    "function executeEmergencyWithdraw(address token, uint256 amount) external"
  ];

  const l1Contract = new ethers.Contract(L1_ADDRESS, L1_ABI, wallet);

  try {
    // Get token address and balance
    const tokenAddress = await l1Contract.TOKEN();
    const balance = await l1Contract.getBalance();
    
    console.log('📊 Contract State:');
    console.log('  Token Address:', tokenAddress);
    console.log('  Balance:', ethers.formatEther(balance), 'tokens');
    console.log('');

    if (balance === 0n) {
      console.log('❌ No tokens to withdraw');
      return;
    }

    // Execute emergency withdraw
    console.log('🚨 Executing Emergency Withdraw...');
    const tx = await l1Contract.executeEmergencyWithdraw(tokenAddress, balance);
    console.log('  Transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('  ✅ Emergency withdraw completed successfully!');
    console.log('  Withdrawn:', ethers.formatEther(balance), 'tokens');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 