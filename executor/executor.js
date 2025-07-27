require('dotenv').config();
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const SIGNER_KEY = process.env.SIGNER_KEY;
const L1_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS;
const L2_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS;
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL;
const PEPU_MAINNET_RPC = "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;

if (!SIGNER_KEY || !L1_ADDRESS || !L2_ADDRESS || !SEPOLIA_RPC_URL || !SUPABASE_URL || !SUPABASE_API_KEY) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

// ABIs for monitoring and calling
const L1_ABI = [
  "event PayoutCompleted(bytes32 indexed transferId, address user, uint256 amount)"
];

const L2_ABI = [
  "function complete(bytes32 transferId, bytes[] calldata signatures, address[] calldata signers) external",
  "function getTransfer(bytes32 transferId) external view returns (tuple(address user, uint256 originalAmount, uint256 bridgedAmount, uint256 timestamp, uint8 status))"
];

const POLL_INTERVAL = 5000; // 5 seconds
let lastCheckedBlock = 0;

// The authorized signer address (from your contract)
const AUTHORIZED_SIGNER = "0x73aF5be3DB46Ce3b7c50Fd833B9C60180f339449";

async function getStartingBlock(provider) {
  try {
    const { data: lastRow, error } = await supabase
      .from('bridged_events')
      .select('l1_block_number')
      .not('l1_block_number', 'is', null)
      .order('l1_block_number', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying Supabase for last L1 block number:', error);
      // Fallback to last 300 blocks if Supabase is unreachable
      const currentBlock = await provider.getBlockNumber();
      const startingBlock = Math.max(0, currentBlock - 300);
      console.log(`📊 Starting from L1 block ${startingBlock} (fallback: last 300 blocks, Supabase unreachable)`);
      return startingBlock;
    }
    
    if (lastRow && lastRow.length > 0) {
      const startingBlock = lastRow[0].l1_block_number;
      console.log(`📊 Starting from L1 block ${startingBlock} (based on last payout block)`);
      return startingBlock;
    } else {
      // First time running - start from contract deployment or recent blocks
      const currentBlock = await provider.getBlockNumber();
      const startingBlock = Math.max(0, currentBlock - 300); // Start from last 300 blocks
      console.log(`📊 Starting from L1 block ${startingBlock} (first run, last 300 blocks)`);
      return startingBlock;
    }
  } catch (err) {
    console.error('❌ Error getting starting block:', err);
          // Fallback to last 300 blocks if any error occurs
      try {
        const currentBlock = await provider.getBlockNumber();
        const startingBlock = Math.max(0, currentBlock - 300);
        console.log(`📊 Starting from L1 block ${startingBlock} (fallback: last 300 blocks, error occurred)`);
      return startingBlock;
    } catch (fallbackErr) {
      console.error('❌ Failed to get current block number:', fallbackErr);
      return null;
    }
  }
}

async function signMessage(transferId, user, bridgedAmount, contractAddress) {
  try {
    // Create the message hash that the contract expects - use encodePacked like the contract
    const rawHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'address', 'uint256', 'address'],
      [transferId, user, bridgedAmount, contractAddress]
    ));
    
    // Sign the raw hash directly - ethers.Wallet.signMessage will handle the Ethereum signed message prefix
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

async function callCompleteOnL2(transferId, user, bridgedAmount, signature) {
  try {
    // Connect to L2 network
    const l2Provider = new ethers.JsonRpcProvider(PEPU_TESTNET_RPC);
    const l2Wallet = new ethers.Wallet(SIGNER_KEY, l2Provider); // Use SIGNER_KEY for transactions (authorized signer)
    const l2Contract = new ethers.Contract(L2_ADDRESS, L2_ABI, l2Wallet);
    
    // Log the wallet address to verify we're using the right key
    console.log('🔑 Executor wallet address:', l2Wallet.address);
    console.log('🔑 Expected authorized signer:', AUTHORIZED_SIGNER);
    
    console.log('⛓️ Calling complete on L2...');
    console.log('Transfer ID:', transferId);
    console.log('User:', user);
    console.log('Bridged Amount:', bridgedAmount.toString());
    
    // Call complete with signature
    const tx = await l2Contract.complete(
      transferId,
      [signature], // signatures array
      [AUTHORIZED_SIGNER] // signers array
    );
    
    console.log('⏳ Waiting for L2 transaction confirmation...');
    await tx.wait();
    
    console.log('✅ L2 complete transaction confirmed!');
    console.log('Transaction hash:', tx.hash);
    
    return tx.hash;
  } catch (err) {
    console.error('❌ Error calling complete on L2:', err);
    throw err;
  }
}

async function updateSupabaseStatus(transferId, status, l1BlockNumber = null) {
  try {
    const updateData = { status: status };
    if (l1BlockNumber) {
      updateData.l1_block_number = l1BlockNumber;
    }
    
    const { error } = await supabase
      .from('bridged_events')
      .update(updateData)
      .eq('tx_id', transferId);
    
    if (error) {
      console.error('❌ Error updating Supabase status:', error);
      throw error;
    }
    
    console.log('✅ Supabase status updated to:', status);
    if (l1BlockNumber) {
      console.log('✅ L1 block number recorded:', l1BlockNumber);
    }
  } catch (err) {
    console.error('❌ Error updating Supabase:', err);
    throw err;
  }
}

async function updateSupabaseComplete(transferId, l1BlockNumber, l2TxHash, signature) {
  try {
    const updateData = {
      status: 'Completed',
      l1_block_number: l1BlockNumber,
      signature1: signature
    };
    
    const { error } = await supabase
      .from('bridged_events')
      .update(updateData)
      .eq('tx_id', transferId);
    
    if (error) {
      console.error('❌ Error updating Supabase completion data:', error);
      throw error;
    }
    
    console.log('✅ Supabase updated with completion data:');
    console.log('  - Status: Completed');
    console.log('  - L1 Block Number:', l1BlockNumber);
    console.log('  - Signature1:', signature);
  } catch (err) {
    console.error('❌ Error updating Supabase completion data:', err);
    throw err;
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const l1Contract = new ethers.Contract(L1_ADDRESS, L1_ABI, provider);

  // Get starting block based on Supabase data
  const startingBlock = await getStartingBlock(provider);
  if (startingBlock === null) {
    console.error('❌ Failed to determine starting block. Exiting.');
    process.exit(1);
  }
  
  lastCheckedBlock = startingBlock;

  console.log('⏳ Executor started - monitoring L1 for payout events...');
  console.log('L1 Contract:', L1_ADDRESS);
  console.log('L2 Contract:', L2_ADDRESS);
  console.log('Authorized Signer:', AUTHORIZED_SIGNER);

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastCheckedBlock) return;

      // Query for PayoutCompleted events since lastCheckedBlock + 1
      const filter = l1Contract.filters.PayoutCompleted();
      const events = await l1Contract.queryFilter(filter, lastCheckedBlock + 1, currentBlock);

      for (const event of events) {
        console.log('🔍 Processing event:', event);
        
        // Parse the event manually if args is undefined
        let transferId, user, amount;
        
        if (event.args) {
          // Normal parsed event
          ({ transferId, user, amount } = event.args);
        } else {
          // Raw event - parse manually
          transferId = event.topics[1];
          user = '0x' + event.topics[2].slice(26); // Remove padding
          amount = ethers.getBigInt(event.data);
        }
        
        const blockNumber = event.blockNumber;
        
        console.log(`\n🔔 PayoutCompleted detected on L1!`);
        console.log('Transfer ID:', transferId);
        console.log('User:', user);
        console.log('Amount:', amount.toString());
        console.log('Block Number:', blockNumber);

        try {
          // Check if this transfer exists in Supabase
          const { data: existing, error: selectError } = await supabase
            .from('bridged_events')
            .select('*')
            .eq('tx_id', transferId)
            .single();

          if (selectError) {
            if (selectError.code === 'PGRST116') {
              console.log('ℹ️ Transfer not found in Supabase (already processed):', transferId);
            } else {
              console.error('❌ Supabase select error:', selectError);
            }
            continue;
          }

          if (!existing) {
            console.log('ℹ️ Transfer not found in Supabase:', transferId);
            continue;
          }

          // Only try if status is pending
          if (existing.status !== 'pending') {
            console.log('⏩ Skipping: status is not pending. Status:', existing.status);
            continue;
          }

          console.log('✅ Found pending transfer in Supabase:', transferId);

          // Get L2 transfer data first to create correct signature
          console.log('🔍 Getting L2 transfer data for signature...');
          const l2Provider = new ethers.JsonRpcProvider(PEPU_TESTNET_RPC);
          const l2Contract = new ethers.Contract(L2_ADDRESS, L2_ABI, l2Provider);
          const transfer = await l2Contract.getTransfer(transferId);
          
          console.log('L2 Transfer data:', {
            user: transfer.user,
            bridgedAmount: transfer.bridgedAmount.toString(),
            status: transfer.status.toString()
          });
          
          // Create signature with L2 transfer data (not L1 event data)
          let signature = existing.signature1;
          if (!signature) {
            console.log('📝 Creating new signature with SIGNER_KEY using L2 data');
            signature = await signMessage(transferId, transfer.user, transfer.bridgedAmount, L2_ADDRESS);
          } else {
            console.log('✅ Using existing signature1');
          }

          // Double-check status before calling complete
          console.log('🔍 Double-checking status before calling complete...');
          const doubleCheck = await l2Contract.getTransfer(transferId);
          console.log('Double-check status:', doubleCheck.status.toString());
          
          // Status enum: Pending=0, Completed=1, Refunded=2
          if (doubleCheck.status === 1n || doubleCheck.status === 1) {
            console.log('❌ Transfer already completed (status=1), skipping...');
            return;
          } else if (doubleCheck.status === 2n || doubleCheck.status === 2) {
            console.log('❌ Transfer was refunded (status=2), skipping...');
            return;
          } else if (doubleCheck.status !== 0n && doubleCheck.status !== 0) {
            console.log('❌ Transfer has unknown status, skipping...');
            return;
          }
          
          // Call complete on L2
          const l2TxHash = await callCompleteOnL2(transferId, user, amount, signature);
          
          // Update Supabase with all the data
          await updateSupabaseComplete(transferId, event.blockNumber, l2TxHash, signature);
          
          console.log('🎉 Complete flow finished successfully!');
          console.log('L1 Payout Event:', event.transactionHash);
          console.log('L2 Complete Tx:', l2TxHash);
          console.log('Supabase Status: completed');

        } catch (err) {
          console.error('❌ Error processing payout event:', err);
        }
      }
      
      lastCheckedBlock = currentBlock;
    } catch (err) {
      console.error('❌ Error polling for events:', err);
    }
  }, POLL_INTERVAL);
}

main().catch(console.error); 