require('dotenv').config();
const { ethers } = require('ethers');

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const L2_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS;
const L1_ADDRESS = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS;
const RPC_URL = process.env.SEPOLIA_RPC_URL;

if (!PRIVATE_KEY || !L2_ADDRESS || !L1_ADDRESS || !RPC_URL) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  process.exit(1);
}

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

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const l2 = new ethers.Contract(L2_ADDRESS, L2_ABI, provider);
  const l1 = new ethers.Contract(L1_ADDRESS, L1_ABI, wallet);

  const latestBlock = await provider.getBlockNumber();
  lastCheckedBlock = latestBlock;

  console.log('⏳ Polling for BridgeInitiated events on L2:', L2_ADDRESS);

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastCheckedBlock) return;

      // Query for BridgeInitiated events since lastCheckedBlock + 1
      const filter = l2.filters.BridgeInitiated();
      const events = await l2.queryFilter(filter, lastCheckedBlock + 1, currentBlock);

      for (const event of events) {
        const { user, originalAmount, bridgedAmount, transferId, timestamp } = event.args;
        console.log(`\n🔔 BridgeInitiated detected!`);
        console.log('User:', user);
        console.log('Original Amount:', originalAmount.toString());
        console.log('Bridged Amount:', bridgedAmount.toString());
        console.log('Transfer ID:', transferId);
        console.log('Timestamp:', timestamp.toString());

        // Query the status from L2
        const transfer = await l2.getTransfer(transferId);
        const statusNum = transfer.status;
        const statusStr = STATUS[statusNum] || `Unknown (${statusNum})`;
        console.log('Current status:', statusStr);

        if (statusNum !== 0) { // 0 = Pending
          console.log('⏩ Skipping payout: status is not Pending.');
          continue;
        }

        try {
          const tx = await l1.payout(transferId, user, bridgedAmount);
          console.log('⛓️  Sent payout tx:', tx.hash);
          await tx.wait();
          console.log('✅ Payout confirmed!');
        } catch (err) {
          console.error('❌ Error processing payout:', err);
        }
      }
      lastCheckedBlock = currentBlock;
    } catch (err) {
      console.error('❌ Error polling for events:', err);
    }
  }, POLL_INTERVAL);
}

main().catch(console.error); 