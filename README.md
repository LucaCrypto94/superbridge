# SuperBridge - PEPU Layer Bridge

**YOUR GATEWAY TO INSTANT BRIDGING ON THE PEPU LAYER**

A comprehensive cross-chain bridge solution for the Pepe Unchained V2 (PEPU) network, enabling seamless token transfers between Layer 1 and Layer 2 with advanced features and security.

## 🚀 Features

- **Instant Bridging**: Fast and secure token transfers between L1 and L2
- **PENK Token Integration**: Built-in support for PENK token requirements
- **Modern UI**: Beautiful, responsive interface built with Next.js and Tailwind CSS
- **Wallet Integration**: Support for MetaMask and other Web3 wallets via RainbowKit
- **Smart Contracts**: Audited OpenZeppelin-based bridge contracts
- **Real-time Monitoring**: Transaction tracking and status updates
- **Admin Panel**: Comprehensive admin interface for bridge management

## 🏗️ Architecture

### Frontend
- **Next.js 15** with React 19
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **RainbowKit** for wallet connection
- **Wagmi** for Ethereum interactions
- **Viem** for low-level blockchain operations

### Smart Contracts
- **SuperBridgeL1.sol**: Layer 1 bridge contract
- **SuperBridgeL2.sol**: Layer 2 bridge contract  
- **PEPU.sol**: PEPU token contract
- Built with **OpenZeppelin** standards for security

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd superbridge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Network Configuration
NEXT_PUBLIC_L1_CHAIN_ID=1
NEXT_PUBLIC_L2_CHAIN_ID=97741
NEXT_PUBLIC_L2_RPC_URL=https://rpc-pepu-v2-mainnet-0.t.conduit.xyz
NEXT_PUBLIC_L2_EXPLORER_URL=https://pepuscan.com

# Contract Addresses
NEXT_PUBLIC_L1_BRIDGE_CONTRACT=0x...
NEXT_PUBLIC_L2_BRIDGE_CONTRACT=0x...
NEXT_PUBLIC_PEPU_TOKEN_CONTRACT=0x...
NEXT_PUBLIC_PENK_TOKEN_CONTRACT=0x...

# Supabase (Optional)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## 🚀 Deployment

### Smart Contracts

1. **Deploy to L1 (Ethereum)**
   ```bash
   npx hardhat run scripts/deploy_l1.js --network mainnet
   ```

2. **Deploy to L2 (PEPU)**
   ```bash
   npx hardhat run scripts/deploy_l2.js --network pepu
   ```

3. **Deploy PEPU Token**
   ```bash
   npx hardhat run scripts/deploy_pepu.js --network pepu
   ```

### Frontend

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to your hosting platform**
   ```bash
   npm run start
   ```

## 📱 Usage

### For Users

1. **Connect Wallet**: Click "Connect Wallet" and select your preferred wallet
2. **Select Network**: Ensure you're on the correct network (Ethereum or PEPU)
3. **Enter Amount**: Input the amount of tokens you want to bridge
4. **Confirm Transaction**: Review and confirm the bridge transaction
5. **Wait for Confirmation**: Monitor the transaction status

### For Developers

The project includes a standalone component that can be integrated into any React application:

```tsx
import SuperBridgeStandalone from './SuperBridgeStandalone';

function App() {
  return <SuperBridgeStandalone />;
}
```

See `README_Standalone.md` for detailed integration instructions.

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx hardhat test` - Run smart contract tests
- `npx hardhat compile` - Compile smart contracts

### Project Structure

```
superbridge/
├── contracts/           # Smart contracts
├── src/
│   ├── app/            # Next.js app directory
│   │   ├── components/ # React components
│   │   ├── api/        # API routes
│   │   └── admin/      # Admin panel
│   └── wagmi.ts        # Wagmi configuration
├── scripts/            # Deployment scripts
├── watcher/            # Transaction monitoring
├── executor/           # Bridge execution logic
└── artifacts/          # Compiled contracts
```

## 🔒 Security

- **Audited Contracts**: Built with OpenZeppelin standards
- **Multi-signature Support**: Admin functions require multiple signatures
- **Pause Mechanism**: Emergency pause functionality
- **Access Control**: Role-based permissions
- **Reentrancy Protection**: Guards against reentrancy attacks

## 🌐 Networks

### Supported Networks

- **Layer 1**: Ethereum Mainnet
- **Layer 2**: Pepe Unchained V2 (Chain ID: 97741)

### Network Details

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Ethereum | 1 | https://eth.llamarpc.com | https://etherscan.io |
| PEPU V2 | 97741 | https://rpc-pepu-v2-mainnet-0.t.conduit.xyz | https://pepuscan.com |

## 📊 Monitoring

The bridge includes comprehensive monitoring tools:

- **Transaction Watcher**: Real-time transaction monitoring
- **Event Logging**: Detailed event tracking
- **Admin Dashboard**: Bridge statistics and management
- **Supabase Integration**: Optional database logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the `README_Standalone.md` for detailed integration guides
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Community**: Join our community for support and updates

## 🔗 Links

- **Website**: [Your website URL]
- **Documentation**: [Your docs URL]
- **Discord**: [Your Discord invite]
- **Twitter**: [Your Twitter handle]

---

**Built with ❤️ for the PEPU community**