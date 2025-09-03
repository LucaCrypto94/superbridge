import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const PENKMARKET_CONTRACT = '0x8a6134Bd33367ee152b4a1178652c9053eda6D57';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "getAllowedTokens",
    "outputs": [{ "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export async function GET() {
  try {
    const allowedTokens = await client.readContract({
      address: PENKMARKET_CONTRACT as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'getAllowedTokens',
    });

    return NextResponse.json({
      success: true,
      allowedTokens: allowedTokens
    });

  } catch (error) {
    console.error('Error fetching allowed tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch allowed tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
