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
    "inputs": [
      {
        "internalType": "string",
        "name": "txid",
        "type": "string"
      }
    ],
    "name": "getTransaction",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenAddress",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint8",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "string",
            "name": "tokenType",
            "type": "string"
          }
        ],
        "internalType": "struct PenkMarket.Transaction",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

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
        user: transaction.user,
        tokenAddress: transaction.tokenAddress,
        amount: BigInt(transaction.amount.toString()),
        timestamp: BigInt(transaction.timestamp.toString()),
        status: Number(transaction.status),
        tokenType: transaction.tokenType,
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
