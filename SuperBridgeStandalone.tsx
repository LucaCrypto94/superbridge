"use client";
import React, { useEffect, useState, createContext, useContext } from "react";

// ============================================================================
// CONFIGURATION SECTION - CUSTOMIZE THESE VALUES
// ============================================================================

interface SuperBridgeConfig {
  // Contract addresses
  l2BridgeContract: string;
  l1BridgeContract: string;
  
  // Token configuration
  tokenContract: string;
  penkContract: string;
  penkMinimum: number;
  
  // Network configuration
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  
  // Theme customization
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  
  // Features
  showPoweredBy: boolean;
  enableTokenRestriction: boolean;
  customBackgroundImage?: string;
}

const DEFAULT_CONFIG: SuperBridgeConfig = {
  // Contract addresses - from environment variables
  l2BridgeContract: process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS || "0x0000000000000000000000000000000000000000",
  l1BridgeContract: process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS || "0x0000000000000000000000000000000000000000",
  
  // Token configuration - only configure restriction token
  tokenContract: "0x93aA0ccD1e5628d3A841C4DbdF602D9eb04085d6", // PEPU token on Ethereum mainnet
  penkContract: "0x0000000000000000000000000000000000000000", // Your restriction token contract
  penkMinimum: 1000000, // Minimum restriction token required
  
  // Network configuration - UPDATE FOR YOUR CHAIN
  chainId: 97741, // Pepe Unchained V2 mainnet
  chainName: "Pepe Unchained V2",
  rpcUrl: "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz",
  explorerUrl: "https://pepuscan.com",
  
  // Theme customization
  primaryColor: "#fbbf24", // Yellow
  secondaryColor: "#16a34a", // Green
  backgroundColor: "#181818", // Dark gray
  textColor: "#ffffff", // White
  
  // Features
  showPoweredBy: true,
  enableTokenRestriction: true,
  customBackgroundImage: undefined, // Set to your image URL or leave undefined
};

// ============================================================================
// WAGMI & RAINBOWKIT SETUP (Self-contained)
// ============================================================================

// Simplified wallet connection context
interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  chainId: number | null;
  switchNetwork: (chainId: number) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};

// Simplified wallet provider
const WalletProvider: React.FC<{ children: React.ReactNode; config: SuperBridgeConfig }> = ({ children, config }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const connect = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setAddress(accounts[0]);
        
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        setChainId(parseInt(chainId, 16));
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  const disconnect = () => {
    setAddress(null);
    setChainId(null);
  };

  const switchNetwork = async (targetChainId: number) => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
        setChainId(targetChainId);
      } catch (error) {
        console.error("Failed to switch network:", error);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        setAddress(accounts[0] || null);
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", (chainId: string) => {
        setChainId(parseInt(chainId, 16));
      });

      // Get initial state
      window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      });

      window.ethereum.request({ method: "eth_chainId" }).then((chainId: string) => {
        setChainId(parseInt(chainId, 16));
      });
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      address,
      isConnected: !!address,
      connect,
      disconnect,
      chainId,
      switchNetwork,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTokenAmount(raw: string | bigint | undefined, decimals: number = 18) {
  if (!raw) return "0.000";
  const num = typeof raw === 'bigint' ? Number(raw) / 10 ** decimals : Number(raw) / 10 ** decimals;
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function shortenAddress(addr: string) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// ============================================================================
// MAIN SUPERBRIDGE COMPONENT
// ============================================================================

interface SuperBridgeProps {
  config?: Partial<SuperBridgeConfig>;
}

export default function SuperBridgeStandalone({ config = {} }: SuperBridgeProps) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  return (
    <WalletProvider config={finalConfig}>
      <SuperBridgeContent config={finalConfig} />
    </WalletProvider>
  );
}

function SuperBridgeContent({ config }: { config: SuperBridgeConfig }) {
  const { address, isConnected, connect, disconnect, chainId, switchNetwork } = useWallet();
  
  const [error, setError] = useState("");
  const [sendAmount, setSendAmount] = useState('');
  const [inputWarning, setInputWarning] = useState('');
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [txError, setTxError] = useState<string | null>(null);
  const [isBridging, setIsBridging] = useState(false);
  const [successTx, setSuccessTx] = useState<{
    original: string;
    received: string;
    hash: string;
  } | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>("0");
  const [pepuBalance, setPepuBalance] = useState<string>("0");
  const [penkBalance, setPenkBalance] = useState<string>("0");
  const [l1PoolBalance, setL1PoolBalance] = useState<string>("0");

  const MAX_POOL = 35009000; // 35,009,000 tokens
  const DECIMALS = 18;
  const PENK_MIN = config.penkMinimum;

  // Check if user is on correct network
  const isWrongNetwork = isConnected && chainId !== config.chainId;

  // Fetch balances
  useEffect(() => {
    if (isConnected && address) {
      // Fetch native balance
      fetchNativeBalance();
      // Fetch PEPU balance
      fetchPepuBalance();
      // Fetch PENK balance
      fetchPenkBalance();
      // Fetch L1 pool balance
      fetchL1PoolBalance();
    }
  }, [isConnected, address, chainId]);

  const fetchNativeBalance = async () => {
    if (typeof window !== "undefined" && window.ethereum && address) {
      try {
        const balance = await window.ethereum.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        });
        const balanceInEth = (parseInt(balance, 16) / 10 ** 18).toFixed(6);
        setNativeBalance(balanceInEth);
      } catch (error) {
        console.error("Failed to fetch native balance:", error);
      }
    }
  };

  const fetchPepuBalance = async () => {
    if (typeof window !== "undefined" && window.ethereum && address) {
      try {
        const balance = await window.ethereum.request({
          method: "eth_call",
          params: [{
            to: config.tokenContract,
            data: "0x70a08231" + "000000000000000000000000" + address.slice(2),
          }, "latest"],
        });
        const balanceInTokens = (parseInt(balance, 16) / 10 ** 18).toFixed(6);
        setPepuBalance(balanceInTokens);
      } catch (error) {
        console.error("Failed to fetch PEPU balance:", error);
      }
    }
  };

  const fetchPenkBalance = async () => {
    if (typeof window !== "undefined" && window.ethereum && address) {
      try {
        const balance = await window.ethereum.request({
          method: "eth_call",
          params: [{
            to: config.penkContract,
            data: "0x70a08231" + "000000000000000000000000" + address.slice(2),
          }, "latest"],
        });
        const balanceInTokens = (parseInt(balance, 16) / 10 ** 18).toFixed(0);
        setPenkBalance(balanceInTokens);
      } catch (error) {
        console.error("Failed to fetch PENK balance:", error);
      }
    }
  };

  const fetchL1PoolBalance = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const balance = await window.ethereum.request({
          method: "eth_call",
          params: [{
            to: config.l1BridgeContract,
            data: "0x70a08231" + "000000000000000000000000" + config.l1BridgeContract.slice(2),
          }, "latest"],
        });
        const balanceInTokens = (parseInt(balance, 16) / 10 ** 18).toFixed(6);
        setL1PoolBalance(balanceInTokens);
      } catch (error) {
        console.error("Failed to fetch L1 pool balance:", error);
      }
    }
  };

  const handleBridge = async () => {
    if (!isConnected || !address) {
      setTxError('Please connect your wallet');
      return;
    }

    if (isWrongNetwork) {
      setTxError('Please switch to the correct network');
      return;
    }

    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setTxError('Please enter a valid amount');
      return;
    }

    // Check PENK balance for minimum requirement
    if (config.enableTokenRestriction && Number(penkBalance) < PENK_MIN) {
      setTxError(`Minimum PENK hold to bridge: ${PENK_MIN.toLocaleString()}`);
      return;
    }

    // Check if amount exceeds available balance
    if (Number(sendAmount) > Number(nativeBalance)) {
      setTxError('Amount exceeds wallet balance');
      return;
    }

    // Check if L1 pool has sufficient balance for bridge amount
    const bridgeAmount = Number(sendAmount) * 0.95; // 95% of original amount (5% fee)
    if (bridgeAmount > Number(l1PoolBalance)) {
      setTxError(`Insufficient pool funds. Please try a smaller amount or check back later.`);
      return;
    }

    setIsBridging(true);
    setTxError(null);

    try {
      const value = BigInt(Math.floor(Number(sendAmount) * 10 ** DECIMALS));
      
      if (typeof window !== "undefined" && window.ethereum) {
        const tx = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            to: config.l2BridgeContract,
            value: "0x" + value.toString(16),
            data: "0x", // bridge() function call
          }],
        });
        
        setTxHash(tx);
        
        // Wait for transaction confirmation
        const receipt = await waitForTransaction(tx);
        if (receipt.status === "0x1") {
          // Success
          const originalAmount = sendAmount;
          const receivedAmount = (Number(originalAmount) * 0.95).toFixed(6);
          
          setSuccessTx({
            original: originalAmount,
            received: receivedAmount,
            hash: tx
          });
          
          setSendAmount('');
          setIsBridging(false);
          setTxHash(undefined);
          setTxError(null);
        } else {
          setTxError('Transaction failed');
          setIsBridging(false);
        }
      }
    } catch (error: any) {
      setTxError(error.message || 'Transaction failed');
      setIsBridging(false);
    }
  };

  const waitForTransaction = async (hash: string): Promise<any> => {
    return new Promise((resolve) => {
      const checkTransaction = async () => {
        try {
          const receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [hash],
          });
          
          if (receipt) {
            resolve(receipt);
          } else {
            setTimeout(checkTransaction, 2000);
          }
        } catch (error) {
          setTimeout(checkTransaction, 2000);
        }
      };
      
      checkTransaction();
    });
  };

  const handleDismissSuccess = () => {
    setSuccessTx(null);
    setSendAmount('');
    setIsBridging(false);
    setTxHash(undefined);
    setTxError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val || isNaN(Number(val))) {
      setSendAmount(val);
      setInputWarning('');
      return;
    }
    const numVal = Number(val);
    if (numVal > Number(nativeBalance)) {
      setSendAmount(nativeBalance);
      setInputWarning('Amount exceeds wallet balance');
    } else {
      setSendAmount(val);
      setInputWarning('');
    }
  };

  // Calculate pool percentage
  const pool = Number(l1PoolBalance);
  const percent = Math.min((pool / MAX_POOL) * 100, 100);

  // Determine if bridge button should be disabled
  const bridgeAmount = sendAmount ? Number(sendAmount) * 0.95 : 0;
  const hasInsufficientL1Pool = bridgeAmount > Number(l1PoolBalance) && bridgeAmount > 0;
  const hasInsufficientPENK = config.enableTokenRestriction && Number(penkBalance) < PENK_MIN;
  
  const isBridgeDisabled = !isConnected || isWrongNetwork || isBridging || !sendAmount || Number(sendAmount) <= 0 || hasInsufficientL1Pool || hasInsufficientPENK;

  // PENK balance color class
  const penkBalanceColorClass = Number(penkBalance) >= PENK_MIN ? 'text-green-400' : 'text-red-400';

  return (
    <div style={{ 
      backgroundColor: config.backgroundColor,
      color: config.textColor,
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: config.backgroundColor,
        borderBottom: `2px solid ${config.primaryColor}`,
        padding: '1rem',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          color: config.primaryColor, 
          fontSize: '2rem', 
          fontWeight: 'bold',
          margin: 0
        }}>
          SuperBridge
        </h1>
        {config.showPoweredBy && (
          <p style={{ 
            color: config.textColor, 
            fontSize: '0.875rem',
            margin: '0.5rem 0 0 0',
            opacity: 0.8
          }}>
            Powered by <span style={{ color: config.primaryColor, fontWeight: 'bold' }}>SuperBridge</span>
          </p>
        )}
      </header>

      {/* Main Content */}
      <div style={{
        backgroundImage: config.customBackgroundImage ? `url(${config.customBackgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        position: 'relative'
      }}>
        {/* Dark overlay for background */}
        {config.customBackgroundImage && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none'
          }} />
        )}

        {/* Main Bridge Card */}
        <div style={{
          backgroundColor: config.backgroundColor,
          border: `2px solid ${config.primaryColor}`,
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '400px',
          width: '100%',
          position: 'relative',
          zIndex: 10
        }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: config.primaryColor,
            marginBottom: '1.5rem'
          }}>
            Bridge Assets
          </h2>

          {/* Network Warning */}
          {isWrongNetwork && (
            <div style={{
              backgroundColor: 'rgba(220, 38, 38, 0.8)',
              border: '1px solid #f87171',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#fecaca',
              fontSize: '0.875rem',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>⚠️ Wrong Network</div>
              <div>Please switch to {config.chainName}</div>
            </div>
          )}

          {/* Copy Notification */}
          {copyNotification && (
            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.8)',
              border: '1px solid #4ade80',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#bbf7d0',
              fontSize: '0.875rem',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold' }}>✅ {copyNotification}</div>
            </div>
          )}

          {/* Network Info */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: config.primaryColor,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: config.backgroundColor,
                fontWeight: 'bold'
              }}>
                L2
              </div>
              <span style={{ fontSize: '0.875rem' }}>
                From <span style={{ fontWeight: 'bold' }}>{config.chainName}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: config.secondaryColor,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                L1
              </div>
              <span style={{ fontSize: '0.875rem' }}>
                To <span style={{ fontWeight: 'bold' }}>Ethereum Mainnet</span>
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: 'black',
            border: `1px solid ${config.primaryColor}`,
            borderRadius: '9999px',
            marginBottom: '0.5rem',
            position: 'relative'
          }}>
            <div
              style={{
                height: '100%',
                backgroundColor: config.secondaryColor,
                borderRadius: '9999px',
                width: `${percent}%`,
                transition: 'width 0.7s ease'
              }}
            />
            <span style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'white'
            }}>
              {percent.toFixed(2)}%
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            marginBottom: '0.25rem'
          }}>
            <span>0</span>
            <span>{MAX_POOL.toLocaleString()}</span>
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            SuperBridge Pool: <span style={{ fontWeight: 'bold' }}>{l1PoolBalance} PEPU</span>
          </div>

          {/* You Send */}
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{
              display: 'block',
              color: config.textColor,
              fontSize: '0.875rem',
              marginBottom: '0.25rem'
            }}>
              You Send
            </label>
            <div style={{
              color: isConnected && !isWrongNetwork ? config.secondaryColor : '#ef4444',
              fontSize: '0.75rem',
              marginBottom: '0.25rem'
            }}>
              {!isConnected ? 'Connect wallet to enter amount' : isWrongNetwork ? 'Switch to correct network' : 'Enter amount to bridge'}
            </div>
            <input
              type="number"
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: `1px solid ${config.primaryColor}`,
                borderRadius: '8px',
                padding: '0.5rem',
                color: config.textColor,
                fontSize: '1rem',
                outline: 'none'
              }}
              value={sendAmount}
              onChange={handleInputChange}
              min="0"
              step="any"
              disabled={!isConnected || isWrongNetwork}
              placeholder="Enter amount"
            />
            {inputWarning && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {inputWarning}
              </div>
            )}
            {hasInsufficientL1Pool && sendAmount && (
              <div style={{ color: '#f97316', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                ⚠️ Insufficient pool funds. Try a smaller amount.
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              marginTop: '0.25rem'
            }}>
              <span style={{ color: '#9ca3af' }}>Available:</span>
              <span>
                {!isConnected ? "0.000 PEPU" : `${nativeBalance} PEPU`}
              </span>
            </div>
            
            {/* PENK Balance Display */}
            {config.enableTokenRestriction && isConnected && !isWrongNetwork && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                marginTop: '0.5rem'
              }}>
                <span style={{ color: '#9ca3af' }}>PENK Balance:</span>
                <span style={{ color: penkBalanceColorClass }}>
                  {penkBalance}
                </span>
              </div>
            )}
          </div>

          {/* Connect/Bridge Button */}
          <div style={{ marginBottom: '1rem' }}>
            {!isConnected ? (
              <button
                onClick={connect}
                style={{
                  width: '100%',
                  backgroundColor: config.primaryColor,
                  color: config.backgroundColor,
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  padding: '0.75rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = config.primaryColor}
              >
                Connect Wallet
              </button>
            ) : (
              <button
                style={{
                  width: '100%',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  padding: '0.75rem',
                  borderRadius: '9999px',
                  border: `1px solid ${config.primaryColor}`,
                  cursor: isBridgeDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: isBridgeDisabled ? '#6b7280' : config.secondaryColor,
                  color: isBridgeDisabled ? '#9ca3af' : config.primaryColor
                }}
                disabled={isBridgeDisabled}
                onClick={handleBridge}
              >
                {isBridging ? 'Bridging...' : 'Bridge Assets'}
              </button>
            )}
          </div>

          {/* Transaction Status Messages */}
          {txError && (
            <div style={{
              color: '#f87171',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              {txError}
            </div>
          )}

          {/* Transaction Pending */}
          {isBridging && txHash && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.9), rgba(67, 56, 202, 0.9))',
              border: '2px solid #60a5fa',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#dbeafe',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.5rem',
                  animation: 'pulse 2s infinite'
                }}>
                  ⏳
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                  Transaction Pending
                </div>
              </div>
              
              <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Your bridge transaction is being processed...
              </div>
              
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px',
                padding: '0.5rem',
                marginBottom: '0.75rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                  Transaction Hash:
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: config.primaryColor,
                  wordBreak: 'break-all'
                }}>
                  {txHash}
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successTx && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(20, 83, 45, 0.9), rgba(6, 78, 59, 0.9))',
              border: '2px solid #4ade80',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#bbf7d0',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.5rem'
                }}>
                  ✓
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                  Bridge Successful!
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.875rem' }}>Amount Bridged:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#86efac' }}>
                    {successTx.original} PEPU
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.875rem' }}>You'll Receive:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: config.primaryColor }}>
                    {successTx.received} PEPU
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.875rem' }}>Network Fee (5%):</span>
                  <span style={{ fontFamily: 'monospace', color: '#fca5a5' }}>
                    {(Number(successTx.original) * 0.05).toFixed(6)} PEPU
                  </span>
                </div>
              </div>
              
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px',
                padding: '0.5rem',
                marginBottom: '0.75rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                  Transaction Hash:
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: config.primaryColor,
                  wordBreak: 'break-all'
                }}>
                  {successTx.hash}
                </div>
              </div>
              
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                ⏱️ Your tokens will arrive on Ethereum mainnet in approximately 30 seconds
              </div>
              
              <button 
                onClick={handleDismissSuccess} 
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
              >
                Continue Bridging
              </button>
            </div>
          )}

          {/* Bridge Info */}
          {isConnected && !isWrongNetwork && (
            <div style={{
              backgroundColor: '#232323',
              border: '1px solid rgba(156, 163, 175, 0.4)',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: '#9ca3af' }}>Recipient address</span>
                <span>{shortenAddress(address || '')}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: '#9ca3af' }}>Time spend</span>
                <span>≈ 30s</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: '#9ca3af' }}>You will receive</span>
                <span>
                  {sendAmount && !isNaN(Number(sendAmount)) ?
                    `${(Number(sendAmount) * 0.95).toLocaleString(undefined, { maximumFractionDigits: 6 })} PEPU`
                    : '0 PEPU'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem'
              }}>
                <span style={{ color: '#9ca3af' }}>Fees (5%)</span>
                <span>
                  {sendAmount && !isNaN(Number(sendAmount)) ?
                    `${(Number(sendAmount) * 0.05).toLocaleString(undefined, { maximumFractionDigits: 6 })} PEPU`
                    : '0 PEPU'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Contract Addresses Section */}
        <div style={{
          marginTop: '2rem',
          maxWidth: '400px',
          width: '100%',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            textAlign: 'center',
            color: config.textColor,
            fontSize: '0.875rem',
            marginBottom: '1rem',
            fontWeight: '600'
          }}>
            Contract Addresses
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: '#232323',
              borderRadius: '8px',
              padding: '0.75rem',
              border: '1px solid #374151'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.5rem'
              }}>
                L2 Bridge Contract ({config.chainName})
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <code style={{
                  fontSize: '0.75rem',
                  color: config.primaryColor,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  {config.l2BridgeContract}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(config.l2BridgeContract);
                    setCopyNotification('L2 Contract copied!');
                    setTimeout(() => setCopyNotification(null), 2000);
                  }}
                  style={{
                    color: config.primaryColor,
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: `1px solid ${config.primaryColor}`,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    fontWeight: '500'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = `${config.primaryColor}20`}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div style={{
              backgroundColor: '#232323',
              borderRadius: '8px',
              padding: '0.75rem',
              border: '1px solid #374151'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.5rem'
              }}>
                L1 Bridge Contract (Ethereum Mainnet)
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <code style={{
                  fontSize: '0.75rem',
                  color: config.primaryColor,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  {config.l1BridgeContract}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(config.l1BridgeContract);
                    setCopyNotification('L1 Contract copied!');
                    setTimeout(() => setCopyNotification(null), 2000);
                  }}
                  style={{
                    color: config.primaryColor,
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: `1px solid ${config.primaryColor}`,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    fontWeight: '500'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = `${config.primaryColor}20`}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
