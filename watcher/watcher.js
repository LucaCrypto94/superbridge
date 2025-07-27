require('dotenv').config();
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const L2_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS;
const L1_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS;
const RPC_URL = "https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;

if (!PRIVATE_KEY || !L2_ADDRESS || !L1_ADDRESS || !SUPABASE_URL || !SUPABASE_API_KEY) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

// Minimal ABIs for event, payout, and getTransfer
const L2_ABI = [
  "event BridgeInitiated(address indexed user, uint256 originalAmount, uint256 bridgedAmount, bytes32 transferId, uint256 timestamp)",
  "function getTransfer(bytes32 transferId) external view returns (tuple(address user, uint256 originalAmount, uint256 bridgedAmount, uint256 timestamp, uint8 status))"
];
const L1_ABI = [
  "function payout(bytes32 transferId, address user, uint256 bridgedAmount) external"
];

// Status enum mapping (from contract)
const STATUS = {
  0: 'Pending',
  1: 'Completed',
  2: 'Refunded',
};

const POLL_INTERVAL = 5000; // 5 seconds
let lastCheckedBlock = 0;

async function getStartingBlock(provider) {
  try {
    const { data: lastRow, error } = await supabase
      .from('bridged_events')
      .select('block_number')
      .order('block_number', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying Supabase for last block number:', error);
      // Fallback to last 100 blocks if Supabase is unreachable
      const currentBlock = await provider.getBlockNumber();
      const startingBlock = Math.max(0, currentBlock - 100);
      console.log(`📊 Starting from block ${startingBlock} (fallback: last 100 blocks, Supabase unreachable)`);
      return startingBlock;
    }
    
    if (lastRow && lastRow.length > 0) {
      // Use the exact block number from the last event
      const startingBlock = lastRow[0].block_number;
      console.log(`📊 Starting from block ${startingBlock} (based on last Supabase block number)`);
      return startingBlock;
    } else {
      // No data in Supabase, start from last 100 blocks
      const currentBlock = await provider.getBlockNumber();
      const startingBlock = Math.max(0, currentBlock - 100);
      console.log(`📊 Starting from block ${startingBlock} (last 100 blocks, no Supabase data)`);
      return startingBlock;
    }
  } catch (err) {
    console.error('❌ Error getting starting block:', err);
    // Fallback to last 100 blocks if any error occurs
    try {
      const currentBlock = await provider.getBlockNumber();
      const startingBlock = Math.max(0, currentBlock - 100);
      console.log(`📊 Starting from block ${startingBlock} (fallback: last 100 blocks, error occurred)`);
      return startingBlock;
    } catch (fallbackErr) {
      console.error('❌ Failed to get current block number:', fallbackErr);
      return null;
    }
  }
}

async function main() {
  const l2Provider = new ethers.JsonRpcProvider(RPC_URL); // PEPU_TESTNET_RPC for L2
  const l1Provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL); // SEPOLIA_RPC_URL for L1
  const l1Wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider);

  const l2 = new ethers.Contract(L2_ADDRESS, L2_ABI, l2Provider);
  const l1 = new ethers.Contract(L1_ADDRESS, L1_ABI, l1Wallet);

  // Get starting block based on Supabase data
  const startingBlock = await getStartingBlock(l2Provider);
  if (startingBlock === null) {
    console.error('❌ Failed to determine starting block. Exiting.');
    process.exit(1);
  }
  
  lastCheckedBlock = startingBlock;

  console.log('⏳ Polling for BridgeInitiated events on L2:', L2_ADDRESS);

  setInterval(async () => {
    try {
      const currentBlock = await l2Provider.getBlockNumber();
      if (currentBlock <= lastCheckedBlock) return;

      // Query for BridgeInitiated events since lastCheckedBlock + 1
      const filter = l2.filters.BridgeInitiated();
      const events = await l2.queryFilter(filter, lastCheckedBlock + 1, currentBlock);

      for (const event of events) {
        const { user, originalAmount, bridgedAmount, transferId, timestamp } = event.args;
        const blockNumber = event.blockNumber;
        
        console.log(`\n🔔 BridgeInitiated detected!`);
        console.log('User:', user);
        console.log('Original Amount:', originalAmount.toString());
        console.log('Bridged Amount:', bridgedAmount.toString());
        console.log('Transfer ID:', transferId);
        console.log('Block Number:', blockNumber);
        console.log('Timestamp:', timestamp.toString());

        // Check if already exists in Supabase
        const { data: existing, error: selectError } = await supabase
          .from('bridged_events')
          .select('tx_id')
          .eq('tx_id', transferId);
        if (selectError) {
          console.error('❌ Supabase select error:', selectError);
          continue;
        }
        if (existing && existing.length > 0) {
          console.log('ℹ️ Already in Supabase:', transferId);
          continue;
        }

        // Query the status from L2 BEFORE storing
        const transfer = await l2.getTransfer(transferId);
        const statusNum = transfer.status;
        const statusStr = STATUS[statusNum] || `Unknown (${statusNum})`;
        console.log('Current status:', statusStr);

        // Only store and process if status is 0 (Pending)
        if (statusNum === 0) {
          // Store to Supabase only for Pending transactions
          const { error: insertError } = await supabase
            .from('bridged_events')
            .insert([
              {
                tx_id: transferId,
                address: user,
                bridged_amount: bridgedAmount.toString(),
                status: 'pending',
                block_number: blockNumber,
                timestamp: timestamp.toString(),
              },
            ]);
          if (insertError) {
            console.error('❌ Supabase insert error:', insertError);
          } else {
            console.log('✅ Added to Supabase (Pending):', transferId);
          }

          // Call payout for Pending transactions
          try {
            const tx = await l1.payout(transferId, user, bridgedAmount);
            console.log('⛓️  Sent payout tx:', tx.hash);
            await tx.wait();
            console.log('✅ Payout confirmed!');
          } catch (err) {
            console.error('❌ Error processing payout:', err);
          }
        } else {
          console.log('⏩ Skipping: status is not Pending (0). Status:', statusStr);
        }
      }
      lastCheckedBlock = currentBlock;
    } catch (err) {
      console.error('❌ Error polling for events:', err);
    }
  }, POLL_INTERVAL);
}

main().catch(console.error); 