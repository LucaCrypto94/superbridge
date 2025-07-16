const { ethers } = require("ethers");
const fs = require("fs");
require('dotenv').config();

// === CONFIGURATION ===
const PEPE_RPC_URL = "https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz"; // Pepe testnet for watching events
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL; // Sepolia for sending ERC20
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SUPERBRIDGE_ADDRESS = "0x3EEbd3c3F5Bf02923E14c6288C7d241C77D83ef7"; // Pepe testnet contract
const ERC20_ADDRESS = "0xaFD224042abbd3c51B82C9f43B681014c12649ca"; // Sepolia ERC20
const ERC20_DECIMALS = 18; // Update if your token uses a different number of decimals
const ABI = [
  "event Bridge(address indexed sender, uint256 originalAmount, uint256 feeAmount, uint256 bridgedAmount)"
];
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)"
];
const LAST_EVENT_FILE = "last_event.txt";

// === SETUP ===
const pepeProvider = new ethers.JsonRpcProvider(PEPE_RPC_URL); // For watching events
const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL); // For sending ERC20
const wallet = new ethers.Wallet(PRIVATE_KEY, sepoliaProvider); // Wallet for Sepolia
const contract = new ethers.Contract(SUPERBRIDGE_ADDRESS, ABI, pepeProvider); // Pepe contract
const erc20 = new ethers.Contract(ERC20_ADDRESS, ERC20_ABI, wallet); // Sepolia ERC20

// === LOAD LAST PROCESSED EVENT ===
let lastProcessed = null;
if (fs.existsSync(LAST_EVENT_FILE)) {
  lastProcessed = fs.readFileSync(LAST_EVENT_FILE, "utf8").trim();
}

// === HELPER: Compare event positions ===
function isAfter(event, last) {
  if (!last) return true;
  const [lastTx, lastIdx] = last.split(":");
  if (event.transactionHash > lastTx) return true;
  if (event.transactionHash === lastTx && event.logIndex > Number(lastIdx)) return true;
  return false;
}

// === MAIN POLLING FUNCTION ===
async function poll() {
  const latestBlock = await pepeProvider.getBlockNumber();
  // Look back a reasonable number of blocks in case of downtime
  const fromBlock = latestBlock - 100 > 0 ? latestBlock - 100 : 0;
  const events = await contract.queryFilter("Bridge", fromBlock, latestBlock);

  let newLastProcessed = lastProcessed;
  for (const event of events) {
    const eventId = `${event.transactionHash}:${event.logIndex}`;
    if (isAfter(event, lastProcessed)) {
      const recipient = event.args.sender;
      const bridgedAmount = event.args.bridgedAmount;
      // If bridgedAmount is already in token decimals, use as is. Otherwise, convert:
      // const amount = ethers.parseUnits(bridgedAmount.toString(), ERC20_DECIMALS);
      const amount = bridgedAmount;

      console.log(`Sending ${amount} tokens to ${recipient} for event ${eventId}`);
      try {
        const tx = await erc20.transfer(recipient, amount);
        await tx.wait();
        console.log(`Transfer successful: ${tx.hash}`);
        if (typeof event.logIndex === 'undefined') {
          console.warn('Warning: event.logIndex is undefined for event', event);
        } else {
          newLastProcessed = eventId;
        }
      } catch (err) {
        console.error(`Transfer failed for event ${eventId}:`, err);
        // Do not update lastProcessed if transfer fails
        break;
      }
    }
  }

  // Save the last processed event
  if (newLastProcessed !== lastProcessed) {
    fs.writeFileSync(LAST_EVENT_FILE, newLastProcessed);
    lastProcessed = newLastProcessed;
  }
}

// === POLL EVERY 10 SECONDS ===
setInterval(poll, 10000);
console.log("Polling for Bridge events on Pepe testnet and sending ERC20 on Sepolia..."); 