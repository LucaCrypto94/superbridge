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

// Event ABI for finding transaction hash - matches the actual contract
const EVENT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "string",
        "name": "txidIndexed",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "txid",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "outputToken",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "penkBonus",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tokenType",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "TransactionCreated",
    "type": "event"
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

    // Try to find the transaction hash and output token from TransactionCreated events
    let transactionHash = null;
    let outputToken = null;
    try {
      // Use the transaction timestamp to estimate the block range
      const transactionTimestamp = Number(transaction.timestamp);
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Estimate block range based on timestamp
      // Ethereum blocks are ~12 seconds apart, so we'll search a reasonable range
      const timeDiff = currentTime - transactionTimestamp;
      const estimatedBlocksAgo = Math.ceil(timeDiff / 12); // 12 seconds per block
      
      // Get current block and calculate search range
      const currentBlock = await client.getBlockNumber();
      const searchStartBlock = currentBlock > BigInt(estimatedBlocksAgo + 1000) 
        ? currentBlock - BigInt(estimatedBlocksAgo + 1000) 
        : BigInt(0);
      const searchEndBlock = currentBlock;
      
      console.log(`Searching for transaction ${txid} in blocks ${searchStartBlock} to ${searchEndBlock}`);
      
      // Search in chunks to stay under RPC limits
      const chunkSize = BigInt(5000);
      let found = false;
      
      for (let fromBlock = searchStartBlock; fromBlock <= searchEndBlock && !found; fromBlock += chunkSize) {
        const toBlock = fromBlock + chunkSize > searchEndBlock ? searchEndBlock : fromBlock + chunkSize;
        
        try {
          const events = await client.getLogs({
            address: PENKMARKET_CONTRACT as `0x${string}`,
            event: {
              type: 'event',
              name: 'TransactionCreated',
              inputs: [
                { type: 'string', name: 'txidIndexed', indexed: true },
                { type: 'string', name: 'txid', indexed: false },
                { type: 'address', name: 'user', indexed: true },
                { type: 'address', name: 'outputToken', indexed: false },
                { type: 'uint256', name: 'amount', indexed: false },
                { type: 'uint256', name: 'penkBonus', indexed: false },
                { type: 'uint256', name: 'totalAmount', indexed: false },
                { type: 'string', name: 'tokenType', indexed: false },
                { type: 'uint256', name: 'timestamp', indexed: false }
              ]
            },
            args: {
              user: transaction.user
            },
            fromBlock,
            toBlock
          });

          // Find the event that matches our txid
          const matchingEvent = events.find(event => 
            event.args.txid === txid
          );
          
          if (matchingEvent) {
            transactionHash = matchingEvent.transactionHash;
            outputToken = matchingEvent.args.outputToken;
            console.log('Found transaction hash:', transactionHash);
            console.log('Found output token:', outputToken);
            found = true;
            break;
          }
        } catch (chunkError) {
          console.log(`Error searching blocks ${fromBlock}-${toBlock}:`, chunkError);
          // Continue to next chunk
        }
      }
      
      if (!found) {
        console.log('No matching event found for txid:', txid);
      }
    } catch (eventError) {
      console.log('Could not fetch transaction hash from events:', eventError);
    }

    return NextResponse.json({
      success: true,
      transaction: {
        user: transaction.user,
        tokenAddress: transaction.tokenAddress,
        amount: transaction.amount.toString(),
        timestamp: transaction.timestamp.toString(),
        status: Number(transaction.status),
        tokenType: transaction.tokenType,
        transactionHash: transactionHash,
        outputToken: outputToken
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
