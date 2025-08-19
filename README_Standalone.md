# SuperBridge Standalone Component

This is a completely self-contained SuperBridge component that can be pasted into any React project without external dependencies. It includes all necessary wallet connection logic, styling, and functionality.

## Features

- 🔌 **Self-contained**: No external imports required
- 🎨 **Fully customizable**: Theme colors, contract addresses, and features
- 🔐 **Token restrictions**: Configurable PENK token requirements
- 📱 **Responsive design**: Works on all device sizes
- 🚀 **Ready to use**: Just paste and configure

## Quick Start

1. **Copy the component**: Copy the entire `SuperBridgeStandalone.tsx` file into your project
2. **Configure contracts**: Update the contract addresses in the configuration
3. **Customize theme**: Modify colors and styling to match your project
4. **Use the component**: Import and render in your app

## Basic Usage

```tsx
import SuperBridgeStandalone from './SuperBridgeStandalone';

function App() {
  return (
    <div>
      <SuperBridgeStandalone />
    </div>
  );
}
```

## Custom Configuration

```tsx
import SuperBridgeStandalone from './SuperBridgeStandalone';

function App() {
  const customConfig = {
    // Contract addresses - REQUIRED
    l2BridgeContract: "0x1234567890123456789012345678901234567890",
    l1BridgeContract: "0x0987654321098765432109876543210987654321",
    tokenContract: "0x1111111111111111111111111111111111111111",
    penkContract: "0x2222222222222222222222222222222222222222",
    
    // Network configuration
    chainId: 97741, // Your L2 chain ID
    chainName: "Your Chain Name",
    rpcUrl: "https://your-rpc-url.com",
    explorerUrl: "https://your-explorer.com",
    
    // Theme customization
    primaryColor: "#3b82f6", // Blue
    secondaryColor: "#10b981", // Green
    backgroundColor: "#0f172a", // Dark blue
    textColor: "#f8fafc", // Light gray
    
    // Features
    showPoweredBy: true,
    enableTokenRestriction: true,
    customBackgroundImage: "https://your-image-url.com/background.jpg"
  };

  return (
    <div>
      <SuperBridgeStandalone config={customConfig} />
    </div>
  );
}
```

## Configuration Options

### Required Configuration

| Option | Type | Description |
|--------|------|-------------|
| `l2BridgeContract` | string | Your L2 bridge contract address |
| `l1BridgeContract` | string | Your L1 bridge contract address |
| `tokenContract` | string | Your token contract address |
| `penkContract` | string | Your PENK token contract address |

### Network Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chainId` | number | 97741 | Your L2 chain ID |
| `chainName` | string | "Pepe Unchained V2" | Your chain name |
| `rpcUrl` | string | Pepe Unchained RPC | Your RPC endpoint |
| `explorerUrl` | string | PepeScan | Your block explorer |

### Theme Customization

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `primaryColor` | string | "#fbbf24" | Primary accent color |
| `secondaryColor` | string | "#16a34a" | Secondary accent color |
| `backgroundColor` | string | "#181818" | Background color |
| `textColor` | string | "#ffffff" | Text color |
| `customBackgroundImage` | string | undefined | Custom background image URL |

### Feature Toggles

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showPoweredBy` | boolean | true | Show "Powered by SuperBridge" text |
| `enableTokenRestriction` | boolean | true | Enable PENK token requirements |
| `penkMinimum` | number | 1000000 | Minimum PENK tokens required |

## Default Configuration

The component comes with sensible defaults for Pepe Unchained V2:

```tsx
const DEFAULT_CONFIG = {
  l2BridgeContract: "0x0000000000000000000000000000000000000000",
  l1BridgeContract: "0x0000000000000000000000000000000000000000",
  tokenContract: "0x0000000000000000000000000000000000000000",
  penkContract: "0x0000000000000000000000000000000000000000",
  penkMinimum: 1000000,
  
  chainId: 97741,
  chainName: "Pepe Unchained V2",
  rpcUrl: "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz",
  explorerUrl: "https://pepuscan.com",
  
  primaryColor: "#fbbf24",
  secondaryColor: "#16a34a",
  backgroundColor: "#181818",
  textColor: "#ffffff",
  
  showPoweredBy: true,
  enableTokenRestriction: true,
  customBackgroundImage: undefined
};
```

## How It Works

1. **Wallet Connection**: Uses native `window.ethereum` for MetaMask and other wallet connections
2. **Balance Fetching**: Fetches token balances using direct RPC calls
3. **Transaction Handling**: Sends bridge transactions and monitors confirmation
4. **Network Validation**: Ensures users are on the correct network
5. **Token Restrictions**: Enforces minimum PENK token holdings if enabled

## Dependencies

The component is completely self-contained and requires no external packages. It only needs:

- React 18+
- TypeScript (optional, but recommended)
- A modern browser with wallet support

## Browser Support

- Chrome/Edge (with MetaMask or similar)
- Firefox (with MetaMask or similar)
- Safari (with WalletConnect or similar)
- Mobile browsers with wallet apps

## Troubleshooting

### Common Issues

1. **"Failed to connect wallet"**: Ensure MetaMask or similar wallet is installed
2. **"Wrong Network"**: User needs to switch to the configured chain
3. **"Insufficient balance"**: User doesn't have enough tokens to bridge
4. **"Transaction failed"**: Check contract addresses and network configuration

### Debug Mode

The component includes console logging for debugging:

```tsx
// Enable debug logging
console.log('SuperBridge Debug:', {
  config,
  walletState: { address, isConnected, chainId },
  balances: { native: nativeBalance, pepu: pepuBalance, penk: penkBalance }
});
```

## Customization Examples

### Blue Theme
```tsx
const blueTheme = {
  primaryColor: "#3b82f6",
  secondaryColor: "#1d4ed8",
  backgroundColor: "#0f172a",
  textColor: "#f8fafc"
};
```

### Green Theme
```tsx
const greenTheme = {
  primaryColor: "#10b981",
  secondaryColor: "#059669",
  backgroundColor: "#064e3b",
  textColor: "#ecfdf5"
};
```

### Purple Theme
```tsx
const purpleTheme = {
  primaryColor: "#8b5cf6",
  secondaryColor: "#7c3aed",
  backgroundColor: "#1e1b4b",
  textColor: "#faf5ff"
};
```

## Security Notes

- Always verify contract addresses before deployment
- Test on testnets first
- Consider adding additional validation for production use
- Monitor for suspicious transactions

## Support

For issues or questions:
1. Check the console for error messages
2. Verify your configuration is correct
3. Ensure you're on the right network
4. Check that contracts are properly deployed

## License

This component is provided as-is for integration into your projects. Customize and use as needed.
