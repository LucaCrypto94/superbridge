const { ethers } = require('ethers');
require('dotenv').config();

// Contract details
const CONTRACT_ADDRESS = '0x8a6134Bd33367ee152b4a1178652c9053eda6D57';
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const OUTPUT_TOKEN = '0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6'; // SPRING
const AMOUNT = ethers.parseUnits('2', 6); // 2 USDC (6 decimals)

// Contract ABI
const CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "outputToken", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "buyWithUSDC",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const USDC_ABI = [
  {
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

async function testUSDCBuy() {
  try {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider('https://eth.drpc.org');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('Wallet address:', wallet.address);
    console.log('Contract address:', CONTRACT_ADDRESS);
    console.log('USDC amount:', ethers.formatUnits(AMOUNT, 6), 'USDC');
    
    // Check USDC balance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, [
      ...USDC_ABI,
      {
        "inputs": [{ "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ], wallet);
    const balance = await usdcContract.balanceOf(wallet.address);
    console.log('USDC balance:', ethers.formatUnits(balance, 6), 'USDC');
    
    if (balance < AMOUNT) {
      console.log('Insufficient USDC balance');
      return;
    }
    
    // Check current allowance
    const allowance = await usdcContract.allowance(wallet.address, CONTRACT_ADDRESS);
    console.log('Current allowance:', ethers.formatUnits(allowance, 6), 'USDC');
    
    // Approve if needed
    if (allowance < AMOUNT) {
      console.log('Approving USDC...');
      const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, AMOUNT, {
        gasLimit: 100000
      });
      console.log('Approve tx hash:', approveTx.hash);
      await approveTx.wait();
      console.log('Approval confirmed');
    }
    
    // Call buyWithUSDC
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log('Calling buyWithUSDC...');
    
    const tx = await contract.buyWithUSDC(OUTPUT_TOKEN, AMOUNT, {
      gasLimit: 1000000
    });
    
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('Transaction confirmed!');
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
  }
}

testUSDCBuy();
