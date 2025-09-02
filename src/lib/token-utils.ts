// Client-side token utilities (no fs import needed)
export interface Token {
  symbol: string;
  path: string;
  address?: string;
  note?: string;
}

export interface Network {
  name: string;
  path: string;
  tokens: Token[];
}

export interface TokenData {
  networks: {
    l1: Network;
    pepeUnchained: Network;
  };
  links: {
    [key: string]: string;
  };
}

// Hardcoded token data for client-side use
const TOKEN_DATA: TokenData = {
  "networks": {
    "l1": {
      "name": "Ethereum Mainnet",
      "path": "networks/eth",
      "tokens": [
        {
          "symbol": "ETH",
          "path": "networks/eth/tokens/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          "note": "WETH address"
        },
        {
          "symbol": "USDC",
          "path": "networks/eth/tokens/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        },
        {
          "symbol": "PEPU",
          "path": "networks/eth/pools/0xb1b10b05aa043dd8d471d4da999782bc694993e3ecbe8e7319892b261b412ed5",
          "note": "PEPU/WETH pool"
        }
      ]
    },
         "pepeUnchained": {
       "name": "Pepe Unchained",
       "path": "networks/pepe-unchained",
       "tokens": [
         {
           "symbol": "SPRING",
           "address": "0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6",
           "path": "networks/pepe-unchained/pools/0xb1ff9a6a353e7ada85a6a100b7992fde9de566f3",
           "note": "SPRING token contract address"
         },
         {
           "symbol": "PENK",
           "address": "0x82144C93bd531E46F31033FE22D1055Af17A514c",
           "path": "networks/pepe-unchained/pools/0x71942200c579319c89c357b55a9d5c0e0ad2403e",
           "note": "PENK token contract address"
         },
         {
           "symbol": "PEPU",
           "address": "0xF9Cf4A16d26979b929Be7176bAc4e7084975FCB8",
           "path": "networks/pepe-unchained/pools/0xb1ff9a6a353e7ada85a6a100b7992fde9de566f3",
           "note": "PEPU token contract address on L2"
         }
       ]
     }
  },
  "links": {
    "spring": "https://www.geckoterminal.com/pepe-unchained/pools/0xb1ff9a6a353e7ada85a6a100b7992fde9de566f3",
    "penk": "https://www.geckoterminal.com/pepe-unchained/pools/0x71942200c579319c89c357b55a9d5c0e0ad2403e"
  }
};

export function getTokenData(): TokenData {
  return TOKEN_DATA;
}

export function getAllTokens(): Token[] {
  const tokenData = getTokenData();
  return [
    ...tokenData.networks.l1.tokens,
    ...tokenData.networks.pepeUnchained.tokens
  ];
}

export function getTokensByNetwork(networkKey: 'l1' | 'pepeUnchained'): Token[] {
  const tokenData = getTokenData();
  return tokenData.networks[networkKey].tokens;
}

export function getTokenBySymbol(symbol: string): Token | undefined {
  const allTokens = getAllTokens();
  return allTokens.find(token => token.symbol === symbol);
}

export function getFromTokens(): string[] {
  // From tokens are the L1 tokens (ETH, USDC, PEPU)
  return getTokensByNetwork('l1').map(token => token.symbol);
}

export function getToTokens(): string[] {
  // To tokens are the Pepe Unchained tokens (SPRING, PENK)
  return getTokensByNetwork('pepeUnchained').map(token => token.symbol);
}

export function getToTokenAddress(symbol: string): string | undefined {
  const token = getTokenData().networks.pepeUnchained.tokens.find(t => t.symbol === symbol);
  return token?.address;
}
