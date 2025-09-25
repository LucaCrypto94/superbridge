import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';

const SUPERBRIDGE_ABI = [
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "getTransfer",
    "outputs": [
      {
        "components": [
          {"name": "user", "type": "address"},
          {"name": "originalAmount", "type": "uint256"},
          {"name": "bridgedAmount", "type": "uint256"},
          {"name": "timestamp", "type": "uint256"},
          {"name": "status", "type": "uint8"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "canRefund",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "transferId", "type": "bytes32"}],
    "name": "getRefundTime",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function POST(request: NextRequest) {
  try {
    const { contractAddress, transferId } = await request.json();

    if (!contractAddress || !transferId) {
      return NextResponse.json({ error: 'Missing contract address or transfer ID' }, { status: 400 });
    }

    const client = createPublicClient({
      chain: {
        id: 97741,
        name: 'Pepe Unchained V2 Mainnet',
        network: 'pepu-v2-mainnet',
        nativeCurrency: {
          decimals: 18,
          name: 'PEPU',
          symbol: 'PEPU',
        },
        rpcUrls: {
          default: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
          public: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
        },
      },
      transport: http(),
    });

    // Call getTransfer function
    const transferData = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: SUPERBRIDGE_ABI,
      functionName: 'getTransfer',
      args: [transferId as `0x${string}`],
    });

    // Check if refund is available
    const canRefund = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: SUPERBRIDGE_ABI,
      functionName: 'canRefund',
      args: [transferId as `0x${string}`],
    });

    // Get refund time
    const refundTime = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: SUPERBRIDGE_ABI,
      functionName: 'getRefundTime',
      args: [transferId as `0x${string}`],
    });

    const statusMap = ['Pending', 'Completed', 'Refunded'];
    
    // Type the response properly
    const transfer = transferData as any;
    
    const result = {
      transferId,
      user: transfer.user,
      originalAmount: transfer.originalAmount.toString(),
      bridgedAmount: transfer.bridgedAmount.toString(),
      timestamp: Number(transfer.timestamp),
      status: statusMap[Number(transfer.status)] as 'Pending' | 'Completed' | 'Refunded',
      canRefund: Boolean(canRefund),
      refundTime: Number(refundTime),
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error checking transaction:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}