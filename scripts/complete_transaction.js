require('dotenv').config();
const { ethers } = require('ethers');

// Load environment variables
const SIGNER_KEY = process.env.SIGNER_KEY;
const TARGET_ID = process.env.TARGET_ID;
const L2_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS;

// Hardcoded PEPU V2 mainnet RPCs to try (no .env required)
const ALTERNATIVE_RPCS = [
  "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz"
];

if (!SIGNER_KEY || !TARGET_ID || !L2_ADDRESS) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  console.error('Required: SIGNER_KEY, TARGET_ID, NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS');
  process.exit(1);
}

// L2 Contract ABI
const L2_ABI = [
  "function complete(bytes32 transferId, bytes[] calldata signatures, address[] calldata signers) external",
  "function getTransfer(bytes32 transferId) external view returns (tuple(address user, uint256 originalAmount, uint256 bridgedAmount, uint256 timestamp, uint8 status))"
];

async function testRpcConnection(rpcUrl) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      polling: false,
      staticNetwork: true
    });
    
    // Set a timeout for the connection test
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );
    
    const networkPromise = provider.getNetwork();
    const network = await Promise.race([networkPromise, timeoutPromise]);
    
    return { provider, network };
  } catch (err) {
    throw new Error(`RPC failed: ${err.message}`);
  }
}

async function findWorkingRpc() {
  console.log('🔍 Testing RPC connections...');
  
  for (let i = 0; i < ALTERNATIVE_RPCS.length; i++) {
    const rpcUrl = ALTERNATIVE_RPCS[i];
    console.log(`  Testing ${i + 1}/${ALTERNATIVE_RPCS.length}: ${rpcUrl}`);
    
    try {
      const { provider, network } = await testRpcConnection(rpcUrl);
      // Enforce mainnet chain id (PEPU V2 mainnet = 97741)
      const chainIdNum = Number(network.chainId);
      if (chainIdNum !== 97741) {
        console.log(`⚠️ Wrong chain detected (chainId=${chainIdNum}), expecting 97741. Skipping.`);
        continue;
      }
      console.log(`✅ Working mainnet RPC found!`);
      console.log(`   Network: ${network.name || 'Unknown'}`);
      console.log(`   Chain ID: ${network.chainId.toString()}`);
      console.log(`   URL: ${rpcUrl}\n`);
      return { provider, rpcUrl };
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
    }
  }
  
  throw new Error('All mainnet RPC URLs failed or wrong chain. Ensure NEXT_PUBLIC_L2_RPC_URL points to PEPU mainnet (chainId 97741).');
}

async function signMessage(transferId, user, bridgedAmount, contractAddress) {
  try {
    // Create the message hash that the contract expects
    const rawHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'address', 'uint256', 'address'],
      [transferId, user, bridgedAmount, contractAddress]
    ));
    
    // Sign the raw hash directly
    const signer = new ethers.Wallet(SIGNER_KEY);
    const signature = await signer.signMessage(ethers.getBytes(rawHash));
    
    console.log('✅ Message signed successfully');
    console.log('Transfer ID:', transferId);
    console.log('User:', user);
    console.log('Bridged Amount:', bridgedAmount.toString());
    console.log('Signature:', signature);
    
    return signature;
  } catch (err) {
    console.error('❌ Error signing message:', err);
    throw err;
  }
}

async function completeTransaction() {
  try {
    console.log('🚀 Starting transaction completion...\n');
    
    // Find a working RPC
    const { provider: l2Provider, rpcUrl } = await findWorkingRpc();
    
    const l2Wallet = new ethers.Wallet(SIGNER_KEY, l2Provider);
    const l2Contract = new ethers.Contract(L2_ADDRESS, L2_ABI, l2Wallet);
    
    // Log wallet info
    console.log('🔑 Signer wallet address:', l2Wallet.address);
    console.log('🎯 Target Transfer ID:', TARGET_ID);
    console.log('📋 L2 Contract:', L2_ADDRESS);
    console.log('🌐 RPC:', rpcUrl);
    console.log('');
    
    // Get transfer data first
    console.log('🔍 Getting transfer data...');
    const transfer = await l2Contract.getTransfer(TARGET_ID);
    
    console.log('📊 Transfer Details:');
    console.log('  - User:', transfer.user);
    console.log('  - Original Amount:', transfer.originalAmount.toString());
    console.log('  - Bridged Amount:', transfer.bridgedAmount.toString());
    console.log('  - Timestamp:', transfer.timestamp.toString());
    console.log('  - Status:', transfer.status.toString());
    console.log('');
    
    // Check status
    if (transfer.status === 1n || transfer.status === 1) {
      console.log('❌ Transfer already completed (status=1)');
      return;
    } else if (transfer.status === 2n || transfer.status === 2) {
      console.log('❌ Transfer was refunded (status=2)');
      return;
    } else if (transfer.status !== 0n && transfer.status !== 0) {
      console.log('❌ Transfer has unknown status:', transfer.status);
      return;
    }
    
    console.log('✅ Transfer is pending, proceeding with completion...\n');
    
    // Create signature
    console.log('📝 Creating signature...');
    const signature = await signMessage(TARGET_ID, transfer.user, transfer.bridgedAmount, L2_ADDRESS);
    console.log('');
    
    // Call complete
    console.log('⛓️ Calling complete on L2...');
    const tx = await l2Contract.complete(
      TARGET_ID,
      [signature], // signatures array
      [l2Wallet.address] // signers array (use the wallet address)
    );
    
    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    
    console.log('🎉 Transaction completed successfully!');
    console.log('Transaction hash:', tx.hash);
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    
  } catch (err) {
    console.error('❌ Error completing transaction:', err);
    process.exit(1);
  }
}

// Run the script
completeTransaction().catch(console.error);