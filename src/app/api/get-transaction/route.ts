import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const PENKMARKET_CONTRACT = '0x8a6134Bd33367ee152b4a1178652c9053eda6D57';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

const CONTRACT_ABI = parseAbi([
  'function getTransaction(string memory txid) external view returns (tuple(address user, address tokenAddress, uint256 amount, uint256 timestamp, uint8 status, string tokenType))'
]);

export async function POST(request: Request) {
  try {
    const { txid } = await request.json();

    if (!txid) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const transaction = await client.readContract({
      address: PENKMARKET_CONTRACT as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'getTransaction',
      args: [txid],
    });

    return NextResponse.json({
      success: true,
      transaction: {
        user: transaction[0],
        tokenAddress: transaction[1],
        amount: BigInt(transaction[2].toString()),
        timestamp: BigInt(transaction[3].toString()),
        status: Number(transaction[4]),
        tokenType: transaction[5],
      }
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
