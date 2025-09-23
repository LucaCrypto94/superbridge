const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SuperBridgeL2 to mainnet...");

  // Get the contract factory
  const SuperBridgeL2 = await ethers.getContractFactory("SuperBridgeL2");
  
  // Deploy the contract
  console.log("📦 Deploying contract...");
  const superBridgeL2 = await SuperBridgeL2.deploy();

  // Wait for deployment
  await superBridgeL2.waitForDeployment();
  const address = await superBridgeL2.getAddress();

  console.log("✅ SuperBridgeL2 deployed successfully!");
  console.log("📍 Contract Address:", address);
  
  // Get deployment info
  const deployer = await superBridgeL2.runner.getAddress();
  console.log("👤 Deployer:", deployer);
  
  // Get current fee settings
  const currentFeeBps = await superBridgeL2.feeBps();
  const feeRecipient = await superBridgeL2.feeRecipient();
  const fundsRecipient = await superBridgeL2.FUNDS_RECIPIENT();
  
  console.log("\n📋 Contract Configuration:");
  console.log("   - Fee BPS:", currentFeeBps.toString(), `(${Number(currentFeeBps) / 100}%)`);
  console.log("   - Fee Recipient:", feeRecipient);
  console.log("   - Funds Recipient:", fundsRecipient);
  console.log("   - Refund Timeout: 30 minutes");
  console.log("   - Min Signatures: 1");
  
  // Get validator info
  const validator = "0x73aF5be3DB46Ce3b7c50Fd833B9C60180f339449";
  const isValidValidator = await superBridgeL2.isValidSigner(validator);
  console.log("   - Validator:", validator, isValidValidator ? "✅" : "❌");
  
  // Get fee exempt info
  const feeExemptAddress = "0x17CaBc8001a30800835DD8206CEB0c4bA90B5913";
  const isFeeExempt = await superBridgeL2.isFeeExempt(feeExemptAddress);
  console.log("   - Fee Exempt:", feeExemptAddress, isFeeExempt ? "✅" : "❌");

  // Verify deployment (optional)
  console.log("\n🔍 Verifying deployment...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("✅ Contract verified on block explorer");
  } catch (error) {
    console.log("⚠️ Verification failed:", error.message);
    console.log("💡 You can verify manually later with:");
    console.log(`   npx hardhat verify --network mainnet ${address}`);
  }

  // Environment variables
  console.log("\n📝 Environment variables to add to your .env:");
  console.log(`NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS=${address}`);
  
  // Contract interaction examples
  console.log("\n🛠️ Contract Management Commands:");
  console.log("   # Set fee to 3% (300 basis points)");
  console.log(`   cast send ${address} "setFeeBps(uint256)" 300 --rpc-url $ETHEREUM_RPC_URL --private-key $PRIVATE_KEY`);
  console.log("");
  console.log("   # Set fee recipient");
  console.log(`   cast send ${address} "setFeeRecipient(address)" 0x... --rpc-url $ETHEREUM_RPC_URL --private-key $PRIVATE_KEY`);
  console.log("");
  console.log("   # Add fee exempt address");
  console.log(`   cast send ${address} "setFeeExempt(address,bool)" 0x... true --rpc-url $ETHEREUM_RPC_URL --private-key $PRIVATE_KEY`);
  console.log("");
  console.log("   # Check current fee");
  console.log(`   cast call ${address} "feeBps()" --rpc-url $ETHEREUM_RPC_URL`);

  console.log("\n🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
