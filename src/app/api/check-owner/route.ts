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
    "name": "owner",
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address is required' },
        { status: 400 }
      );
    }

    const owner = await client.readContract({
      address: PENKMARKET_CONTRACT as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'owner',
    });

    const isOwner = owner.toLowerCase() === address.toLowerCase();

    return NextResponse.json({
      success: true,
      isOwner,
      owner: owner,
      userAddress: address
    });

  } catch (error) {
    console.error('Error checking owner:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check owner status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
