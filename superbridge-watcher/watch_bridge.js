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
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"originalAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"feeAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bridgedAmount","type":"uint256"}],"name":"Bridge","type":"event"},
  {"inputs":[],"name":"BPS_DENOMINATOR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"FEE_BPS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"bridge","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[],"name":"feeRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"totalBridged","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)"
];
const LAST_EVENT_FILE = "last_event.txt";
const PROCESSED_EVENTS_FILE = "processed_events.txt";
// === ENV VALIDATION ===
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is missing from .env');
if (!SEPOLIA_RPC_URL) throw new Error('SEPOLIA_RPC_URL is missing from .env');

// Ensure the file exists
if (!fs.existsSync(PROCESSED_EVENTS_FILE)) {
  fs.writeFileSync(PROCESSED_EVENTS_FILE, "");
}
// Read all processed event IDs into a Set
function loadProcessedEvents() {
  return new Set(fs.readFileSync(PROCESSED_EVENTS_FILE, "utf8").split("\n").filter(Boolean));
}

// === SETUP ===
const pepeProvider = new ethers.JsonRpcProvider(PEPE_RPC_URL); // For watching events
const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL); // For sending ERC20
const wallet = new ethers.Wallet(PRIVATE_KEY, sepoliaProvider); // Wallet for Sepolia
const contract = new ethers.Contract(SUPERBRIDGE_ADDRESS, ABI, pepeProvider); // Pepe contract
const erc20 = new ethers.Contract(ERC20_ADDRESS, ERC20_ABI, wallet); // Sepolia ERC20

// === LOAD LAST PROCESSED EVENT ===
let lastProcessedBlock = 0;
let lastProcessedTx = null;
let lastProcessedIdx = null;
if (fs.existsSync(LAST_EVENT_FILE)) {
  const [block, tx, idx] = fs.readFileSync(LAST_EVENT_FILE, "utf8").trim().split(":");
  lastProcessedBlock = Number(block);
  lastProcessedTx = tx;
  lastProcessedIdx = Number(idx);
}


// === HELPER: Compare event positions ===
function isAfterEvent(event, block, tx, idx) {
  if (event.blockNumber > block) return true;
  if (event.blockNumber === block) {
    if (event.transactionHash > tx) return true;
    if (event.transactionHash === tx && event.index > idx) return true;
  }
  return false;
}

// === MAIN POLLING FUNCTION ===
async function poll() {
  try {
    const processedEvents = loadProcessedEvents();
    console.log('Current processed_events.txt before poll:', fs.readFileSync(PROCESSED_EVENTS_FILE, 'utf8'));
    console.log('Polling for events...');
    const latestBlock = await pepeProvider.getBlockNumber();
    const fromBlock = latestBlock - 100 > 0 ? latestBlock - 100 : 0;
    const events = await contract.queryFilter("Bridge", fromBlock, latestBlock);
    console.log(`Found ${events.length} Bridge events from block ${fromBlock} to ${latestBlock}`);

    for (const event of events) {
      // Use a composite event ID for uniqueness
      const eventId = [
        event.blockNumber,
        event.transactionHash,
        event.index,
        event.args.sender,
        event.args.bridgedAmount.toString()
      ].join(':');
      console.log('Checking eventId:', eventId);
      if (processedEvents.has(eventId)) {
        console.log(`Skipping already processed event: ${eventId}`);
        continue;
      }
      const recipient = event.args.sender;
      const bridgedAmount = event.args.bridgedAmount;
      // If your ERC20 uses 18 decimals and bridgedAmount is in wei, this is fine. Otherwise, convert as needed.
      const amount = bridgedAmount;
      console.log(`Sending ${amount} tokens to ${recipient} for event ${eventId}`);
      fs.appendFileSync(PROCESSED_EVENTS_FILE, eventId + "\n");
      processedEvents.add(eventId);
      console.log('Appended to processed_events.txt:', eventId);
      try {
        const tx = await erc20.transfer(recipient, amount);
        await tx.wait();
        console.log(`Transfer successful: ${tx.hash}`);
      } catch (err) {
        console.error(`Transfer failed for event ${eventId}:`, err);
        continue;
      }
    }
    // Deduplicate the file after every poll
    const uniqueEvents = Array.from(new Set(fs.readFileSync(PROCESSED_EVENTS_FILE, "utf8").split("\n").filter(Boolean)));
    fs.writeFileSync(PROCESSED_EVENTS_FILE, uniqueEvents.join("\n") + (uniqueEvents.length ? "\n" : ""));
    console.log('Current processed_events.txt after poll:', fs.readFileSync(PROCESSED_EVENTS_FILE, 'utf8'));
  } catch (e) {
    console.error('Polling error:', e);
  }
}

// === POLL EVERY 10 SECONDS ===
setInterval(poll, 5000);
console.log("Polling for Bridge events on Pepe testnet and sending ERC20 on Sepolia..."); 