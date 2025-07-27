const { ethers } = require('hardhat');
require('dotenv').config();

const L2_ADDRESS = "0xda6145E6c1E88f7C382e50aeF8DEF5EC656c1C78";
const SIGNER_KEY = process.env.SIGNER_KEY;
const PEPU_TESTNET_RPC = "https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz";

async function main() {
  console.log('🔍 Debugging complete function...');
  
  // Connect to L2
  const l2Provider = new ethers.JsonRpcProvider(PEPU_TESTNET_RPC);
  const l2Wallet = new ethers.Wallet(process.env.PRIVATE_KEY, l2Provider); // Use PRIVATE_KEY for transactions (has ETH)
  const signerWallet = new ethers.Wallet(SIGNER_KEY); // Use SIGNER_KEY only for signing
  // Use the full ABI from artifacts
  const L2_ABI = [
    "function complete(bytes32 transferId, bytes[] calldata signatures, address[] calldata signers) external",
    "function getTransfer(bytes32 transferId) external view returns (tuple(address user, uint256 originalAmount, uint256 bridgedAmount, uint256 timestamp, uint8 status))",
    "function isValidSigner(address signer) external view returns (bool)",
    "function numSigners() external view returns (uint256)",
    "function MIN_SIGNATURES() external view returns (uint256)",
    "function paused() external view returns (bool)",
    "function owner() external view returns (address)"
  ];
  
  const l2Contract = new ethers.Contract(L2_ADDRESS, L2_ABI, l2Wallet);

  const transferId = "0xb872d3602c5c8d73904da06bb3fe9ae968fca3112a999fd0a0ec11bfcf5e6bc7";
  const user = "0x62942bbbb86482bfa0c064d0262e23ca04ea99c5";
  const bridgedAmount = ethers.parseEther("4.75");
  const authorizedSigner = "0x73aF5be3DB46Ce3b7c50Fd833B9C60180f339449";

  console.log('🔑 Signer Info:');
  console.log('  - SIGNER_KEY length:', SIGNER_KEY ? SIGNER_KEY.length : 'undefined');
  console.log('  - SIGNER_KEY starts with:', SIGNER_KEY ? SIGNER_KEY.slice(0, 10) + '...' : 'undefined');
  console.log('  - Signer wallet address:', signerWallet.address);
  console.log('  - Transaction wallet address:', l2Wallet.address);
  console.log('  - Expected signer:', authorizedSigner);
  console.log('  - Signer addresses match:', signerWallet.address.toLowerCase() === authorizedSigner.toLowerCase());

  console.log('📋 Checking contract state...');
  
  // Check if transfer exists
  try {
    const transfer = await l2Contract.getTransfer(transferId);
    console.log('✅ Transfer found:', transfer);
    console.log('  - User:', transfer[0]);
    console.log('  - Original Amount:', ethers.formatEther(transfer[1]));
    console.log('  - Bridged Amount:', ethers.formatEther(transfer[2]));
    console.log('  - Timestamp:', transfer[3]);
    console.log('  - Status:', transfer[4]); // 0=Pending, 1=Completed, 2=Refunded
  } catch (err) {
    console.log('❌ Transfer not found or error:', err.message);
  }

  // Check signer validation
  try {
    const isValid = await l2Contract.isValidSigner(authorizedSigner);
    console.log('✅ Is authorized signer valid:', isValid);
  } catch (err) {
    console.log('❌ Error checking signer:', err.message);
  }

  // Check numSigners and MIN_SIGNATURES
  try {
    const numSigners = await l2Contract.numSigners();
    const minSignatures = await l2Contract.MIN_SIGNATURES();
    console.log('✅ Num Signers:', numSigners.toString());
    console.log('✅ Min Signatures:', minSignatures.toString());
  } catch (err) {
    console.log('❌ Error checking signatures:', err.message);
  }

  // Check if contract is paused
  try {
    const paused = await l2Contract.paused();
    console.log('✅ Contract paused:', paused);
  } catch (err) {
    console.log('❌ Error checking pause status:', err.message);
  }

  // Check contract owner
  try {
    const owner = await l2Contract.owner();
    console.log('✅ Contract owner:', owner);
  } catch (err) {
    console.log('❌ Error checking owner:', err.message);
  }

  // Check contract balance
  try {
    const balance = await l2Provider.getBalance(L2_ADDRESS);
    console.log('✅ Contract balance:', ethers.formatEther(balance), 'ETH');
  } catch (err) {
    console.log('❌ Error checking balance:', err.message);
  }

  // Test signature creation
  console.log('\n🔐 Testing signature creation...');
  try {
    const rawHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'address', 'uint256', 'address'],
      [transferId, user, bridgedAmount, L2_ADDRESS]
    ));
    console.log('✅ Raw Hash:', rawHash);
    
    const messageHash = ethers.hashMessage(ethers.getBytes(rawHash));
    console.log('✅ Message Hash:', messageHash);
    
    const signature = await signerWallet.signMessage(ethers.getBytes(messageHash));
    console.log('✅ Signature:', signature);
    
    // Verify signature recovery
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    console.log('✅ Recovered Address:', recovered);
    console.log('✅ Expected Address:', authorizedSigner);
    console.log('✅ Addresses match:', recovered.toLowerCase() === authorizedSigner.toLowerCase());
    
    // Try calling complete function
    console.log('\n🚀 Testing complete function...');
    try {
      // Log the encoded data first
      const encodedData = l2Contract.interface.encodeFunctionData('complete', [
        transferId,
        [signature],
        [authorizedSigner]
      ]);
      console.log('✅ Encoded data:', encodedData);
      
      // Send transaction manually with encoded data
      const tx = await l2Wallet.sendTransaction({
        to: L2_ADDRESS,
        data: encodedData,
        gasLimit: 500000
      });
      console.log('✅ Complete transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Complete transaction confirmed!');
    } catch (err) {
      console.log('❌ Complete function error:', err.message);
      console.log('❌ Error details:', err);
    }
    
  } catch (err) {
    console.log('❌ Error creating signature:', err.message);
  }
}

main().catch(console.error); 