const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying fixed SuperBridgeL2 contract...");

  const SuperBridgeL2 = await ethers.getContractFactory("SuperBridgeL2");
  const superBridgeL2 = await SuperBridgeL2.deploy();

  await superBridgeL2.waitForDeployment();
  const address = await superBridgeL2.getAddress();

  console.log("✅ SuperBridgeL2 deployed to:", address);
  console.log("📋 Contract details:");
  console.log("   - Funds Recipient: 0x23d26298248FFCc71f49849fA0beB8e30A2bdE6C");
  console.log("   - No emergency withdraw functions");
  console.log("   - Funds from complete() go to fixed recipient");
  console.log("   - Users can still refund after 30 minutes");
  console.log("   - Owner cannot drain the pool");

  // Verify the deployment
  console.log("\n🔍 Verifying deployment...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("✅ Contract verified on block explorer");
  } catch (error) {
    console.log("⚠️ Verification failed:", error.message);
  }

  console.log("\n📝 Environment variables to add:");
  console.log(`NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 