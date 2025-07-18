require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

module.exports = {
  solidity: "0.8.20", // or "v0.8.30" if you used that version
  networks: {
    'pepu-v2-testnet-vn4qxxp9og': {
      url: 'https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    'pepu-v2-mainnet': {
      url: 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz',
      chainId: 97741,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      'pepu-v2-testnet-vn4qxxp9og': 'empty',
      'pepu-v2-mainnet': 'empty',
    },
    customChains: [
      {
        network: "pepu-v2-testnet-vn4qxxp9og",
        chainId: 97740,
        urls: {
          apiURL: "https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/api",
          browserURL: "https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz:443"
        }
      },
      {
        network: "pepu-v2-mainnet",
        chainId: 97741,
        urls: {
          apiURL: "https://pepuscan.com/api",
          browserURL: "https://pepuscan.com/"
        }
      }
    ]
  }
}; 