import { NextResponse } from 'next/server';
import { getTokenBySymbol, Token } from '@/lib/token-utils';

export const dynamic = 'force-dynamic';

const GECKO_TERMINAL_API = 'https://api.geckoterminal.com/api/v2';

async function fetchTokenPrice(token: Token): Promise<number> {
  try {
    const url = `${GECKO_TERMINAL_API}/${token.path}`;
    console.log(`Fetching ${token.symbol} price from:`, url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`${token.symbol} API response:`, JSON.stringify(data, null, 2));
    
    if (!data.data || !data.data.attributes) {
      throw new Error('Invalid response format');
    }
    
    let price: number;
    
    // Determine if this is a pool or token
    const isPool = token.path.includes('/pools/');
    
    if (isPool) {
      // Handle pool data
      const attributes = data.data.attributes;
      price = parseFloat(attributes.base_token_price_usd);
    } else {
      // Handle token data
      const attributes = data.data.attributes;
      price = parseFloat(attributes.price_usd);
    }
    
    if (isNaN(price)) {
      throw new Error('Invalid price data');
    }
    
    return price;
  } catch (error) {
    console.error(`Error fetching ${token.symbol} price:`, error);
    return 0;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromToken, fromAmount, toToken } = body;

    if (!fromToken || !fromAmount || !toToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: fromToken, fromAmount, toToken' 
        },
        { status: 400 }
      );
    }

    // Get token objects from the utility function
    const fromTokenObj = getTokenBySymbol(fromToken);
    const toTokenObj = getTokenBySymbol(toToken);

    if (!fromTokenObj || !toTokenObj) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid token: ${!fromTokenObj ? fromToken : toToken}` 
        },
        { status: 400 }
      );
    }

    // Fetch current token prices directly from GeckoTerminal
    const [fromTokenPrice, toTokenPrice] = await Promise.all([
      fetchTokenPrice(fromTokenObj),
      fetchTokenPrice(toTokenObj)
    ]);

    // Also fetch PEPU price for equivalent calculation
    const pepuToken = getTokenBySymbol('PEPU');
    let pepuPrice = 0;
    if (pepuToken) {
      pepuPrice = await fetchTokenPrice(pepuToken);
    }

    console.log(`Fetched prices - ${fromToken}: $${fromTokenPrice}, ${toToken}: $${toTokenPrice}, PEPU: $${pepuPrice}`);

    if (fromTokenPrice === 0 || toTokenPrice === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to fetch prices for ${fromToken} or ${toToken}` 
        },
        { status: 500 }
      );
    }

    // Calculate USD value of input amount
    let inputUsdValue = 0;
    if (fromToken === 'ETH') {
      inputUsdValue = parseFloat(fromAmount) * fromTokenPrice;
    } else if (fromToken === 'USDC') {
      inputUsdValue = parseFloat(fromAmount); // USDC is 1:1 with USD
    } else if (fromToken === 'PEPU') {
      inputUsdValue = parseFloat(fromAmount) * fromTokenPrice;
    }

    console.log(`Input USD value: $${inputUsdValue}`);

    // Apply 2% PenkBonus (same as L1 contract)
    const penkBonusBasisPoints = 200; // 2% = 200 basis points
    const penkBonus = (inputUsdValue * penkBonusBasisPoints) / 10000;
    const totalUsdValue = inputUsdValue + penkBonus;

    console.log(`PenkBonus: $${penkBonus.toFixed(2)} (2%)`);
    console.log(`Total USD value with bonus: $${totalUsdValue.toFixed(2)}`);

    // Calculate how many target tokens will be received (including bonus)
    const tokensReceived = totalUsdValue / toTokenPrice;
    
    // Calculate PEPU equivalent amount
    let pepuEquivalent = 0;
    if (pepuPrice > 0) {
      pepuEquivalent = totalUsdValue / pepuPrice;
    }
    
    console.log(`Tokens received: ${tokensReceived} ${toToken}`);
    console.log(`PEPU equivalent: ${pepuEquivalent} PEPU`);

    return NextResponse.json({
      success: true,
      data: {
        tokensReceived: parseFloat(tokensReceived.toFixed(6)),
        fromTokenPrice,
        toTokenPrice,
        inputUsdValue: parseFloat(inputUsdValue.toFixed(2)),
        penkBonus: parseFloat(penkBonus.toFixed(2)),
        totalUsdValue: parseFloat(totalUsdValue.toFixed(2)),
        penkBonusPercentage: "2%",
        pepuEquivalent: parseFloat(pepuEquivalent.toFixed(6)),
        pepuPrice: parseFloat(pepuPrice.toFixed(6))
      }
    });

  } catch (error) {
    console.error('Error in quote API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate quote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
