import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const walletAddress = process.env.NEXT_PUBLIC_SUPERBRIDGE_POOL;
  const contractAddress = '0x93aA0ccD1e5628d3A841C4DbdF602D9eb04085d6';

  if (!apiKey || !walletAddress) {
    return NextResponse.json({ error: 'Missing API key or wallet address' }, { status: 500 });
  }

  // Etherscan API endpoint for ERC20 token balance
  const url = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}&tag=latest&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1') {
      return NextResponse.json({ error: data.result || 'Failed to fetch balance' }, { status: 500 });
    }
    // result is a string of the balance in the token's smallest unit (usually wei)
    return NextResponse.json({ balance: data.result });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch token balance' }, { status: 500 });
  }
} 