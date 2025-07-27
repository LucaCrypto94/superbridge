// check_events.js - Check for PayoutCompleted events
require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const l1Contract = new ethers.Contract(
    '0x890e4E62a41F0A5D942A8B158BBC5BeF0ca79C89', 
    ['event PayoutCompleted(bytes32 indexed transferId, address user, uint256 amount)'], 
    provider
  );

  console.log('🔍 Checking for PayoutCompleted events...');
  
  // Check recent blocks
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 200; // Last 200 blocks
  
  console.log(`Checking blocks ${fromBlock} to ${currentBlock}`);
  
  try {
    const events = await l1Contract.queryFilter(
      l1Contract.filters.PayoutCompleted(), 
      fromBlock, 
      currentBlock
    );
    
    console.log(`Found ${events.length} PayoutCompleted events`);
    
    events.forEach((event, i) => {
      console.log(`\nEvent ${i + 1}:`);
      console.log('Full event:', JSON.stringify(event, null, 2));
      console.log('Args:', event.args);
      console.log('Block:', event.blockNumber);
      console.log('Tx Hash:', event.transactionHash);
    });
    
  } catch (error) {
    console.error('❌ Error querying events:', error);
  }
}

main().catch(console.error); 