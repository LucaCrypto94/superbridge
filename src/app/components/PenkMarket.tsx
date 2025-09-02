"use client";
import React, { useEffect, useState } from "react";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { readContract } from '@wagmi/core';
import { config } from '@/wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import '@rainbow-me/rainbowkit/styles.css';
import { getFromTokens, getToTokens, getTokenBySymbol, getToTokenAddress } from '@/lib/token-utils';

// Removed MAX_POOL - showing full green bar with actual balance
const DECIMALS = 18; // PEPU token decimals
const PEPU_CONTRACT = "0x93aA0ccD1e5628d3A841C4DbdF602D9eb04085d6"; // Ethereum mainnet PEPU token (the one SuperBridge uses)
const USDC_CONTRACT = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // Ethereum mainnet USDC token
const PENK_CONTRACT = "0x82144C93bd531E46F31033FE22D1055Af17A514c";
const PENK_MIN = 1000000;
const PENK_BUY_LINK = "https://www.geckoterminal.com/pepe-unchained/pools/0x71942200c579319c89c357b55a9d5C0E0aD2403e";
const CORRECT_CHAIN_ID = 1; // Ethereum mainnet for PenkMarket

const PENKMARKET_CONTRACT = "0x8a6134Bd33367ee152b4a1178652c9053eda6D57" as `0x${string}`;
const L2_POOL_CONTRACT = "0xC4a9B2416f5605332e029c77A4eB2bBb74ADceBD" as `0x${string}`;
const L2_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS as `0x${string}`;
const PENKMARKET_ABI = [
  {
    "inputs": [
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "bridgeToL2",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "name": "balance", "type": "uint256" }
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      { "name": "", "type": "uint8" }
    ],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [
      { "name": "", "type": "bool" }
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" },
      { "name": "_spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [
      { "name": "", "type": "uint256" }
    ],
    "type": "function"
  }
];

// Get token options dynamically from token utilities
function getTokenOptions() {
  const fromTokens = getFromTokens();
  return fromTokens.map(symbol => {
    const token = getTokenBySymbol(symbol);
    let address = 'native';
    let decimals = 18;
    let name = symbol;
    let icon = '/ethereum-logo.png';
    
    switch (symbol) {
      case 'ETH':
        name = 'Ethereum';
        icon = '/ethereum-logo.png';
        break;
      case 'USDC':
        name = 'USD Coin';
        address = USDC_CONTRACT;
        decimals = 6;
        icon = '/usdc-logo.png';
        break;
      case 'PEPU':
        name = 'Pepe Unchained';
        address = PEPU_CONTRACT;
        decimals = 18;
        icon = '/pepu-logo.png';
        break;
    }
    
    return {
      symbol,
      name,
      address,
      decimals,
      icon
    };
  });
}

const TOKEN_OPTIONS = getTokenOptions();

function formatTokenAmount(raw: string | bigint | undefined) {
  if (!raw) return "0.000";
  const num = typeof raw === 'bigint' ? Number(raw) / 10 ** DECIMALS : Number(raw) / 10 ** DECIMALS;
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function shortenAddress(addr: string) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function PenkMarket() {
  const [error, setError] = useState("");
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [inputWarning, setInputWarning] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [txError, setTxError] = useState<string | null>(null);
  const [isBridging, setIsBridging] = useState(false);
  const [successTx, setSuccessTx] = useState<{
    original: string;
    received: string;
    hash: string;
  } | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState(TOKEN_OPTIONS[0]); // Default to ETH
  const [selectedToToken, setSelectedToToken] = useState('SPRING'); // Default to SPRING
  const [quoteData, setQuoteData] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<'approval' | 'execution' | null>(null);

  // Debug needsApproval state changes
  useEffect(() => {
    console.log('needsApproval state changed to:', needsApproval);
  }, [needsApproval]);

  const { data: nativeBalance, isLoading: isNativeBalanceLoading } = useBalance({
    address: address,
    chainId: CORRECT_CHAIN_ID,
  });

  // Get L2 pool balance (PEPU tokens on L2)
  const { data: l2PoolBalance, isLoading: isL2PoolBalanceLoading, error: balanceError } = useReadContract({
    address: L2_POOL_CONTRACT,
    abi: [
      {
        "inputs": [],
        "name": "getContractBalance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: "getContractBalance",
    chainId: 97741, // Pepe Unchained V2 mainnet
  });

  const { writeContract, isPending, data: writeData, error: writeError } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CORRECT_CHAIN_ID,
  });

  // Check if user is on correct network
  const isWrongNetwork = isConnected && chainId !== CORRECT_CHAIN_ID;

  // Handle writeContract data (transaction hash)
  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
    }
  }, [writeData]);

  // Handle writeContract errors
  useEffect(() => {
    if (writeError) {
      let friendlyError = writeError.message || 'Transaction failed';
      
      // Make chain mismatch errors more user-friendly
      if (writeError.message?.includes('chain') && writeError.message?.includes('does not match')) {
        friendlyError = 'Please switch to Ethereum mainnet to bridge your tokens';
      }
      
      setTxError(friendlyError);
      setIsBridging(false);
      setIsApproving(false);
    }
  }, [writeError]);

  useEffect(() => {
    if (isTxSuccess && txHash) {
      if (lastTransactionType === 'execution') {
      // Calculate received amount (95% of original)
      const originalAmount = sendAmount;
      const receivedAmount = (Number(originalAmount) * 0.95).toFixed(6);
      
      setSuccessTx({
        original: originalAmount,
        received: receivedAmount,
        hash: txHash
      });
      
        // Reset form only for execution transactions
      setSendAmount('');
      setIsBridging(false);
      setIsApproving(false);
      setTxHash(undefined);
      setTxError(null);
        setLastTransactionType(null);
      } else if (lastTransactionType === 'approval') {
        // For approval transactions, just reset the approval state
        setIsApproving(false);
        setTxHash(undefined);
        setTxError(null);
        setLastTransactionType(null);
        // Re-check approval status and auto-execute
        setTimeout(async () => {
          await checkApprovalNeeded();
          // Auto-execute after approval
          if (!needsApproval) {
            console.log('Auto-executing transaction after approval...');
            setTimeout(() => {
              handleExecuteTransaction();
            }, 500);
          }
        }, 1000);
      }
    }
  }, [isTxSuccess, txHash, sendAmount, lastTransactionType]);

  function handleDismissSuccess() {
    setSuccessTx(null);
    setSendAmount('');
    setIsBridging(false);
    setIsApproving(false);
    setTxHash(undefined);
    setTxError(null);
  }

  // Check token allowance (only for ERC20 tokens, not ETH)
  const { data: allowance } = useReadContract({
    address: selectedToken.address !== 'native' ? selectedToken.address as `0x${string}` : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && PENKMARKET_CONTRACT && selectedToken.address !== 'native' ? [address, PENKMARKET_CONTRACT] : undefined,
    chainId: CORRECT_CHAIN_ID,
    query: {
      enabled: selectedToken.address !== 'native' && !!address && !!PENKMARKET_CONTRACT,
    },
  });

  // Check if approval is needed (only for ERC20 tokens, not ETH)
  useEffect(() => {
    if (sendAmount && allowance && typeof allowance === 'bigint' && selectedToken.address !== 'native') {
      let decimals = 18; // Default to 18
      if (selectedToken.symbol === 'USDC') {
        decimals = 6; // USDC has 6 decimals
      } else if (selectedToken.symbol === 'PEPU') {
        decimals = 18; // PEPU has 18 decimals
      }
      
      const requiredAmount = BigInt(Math.floor(Number(sendAmount) * 10 ** decimals));
      setNeedsApproval(allowance < requiredAmount);
    } else {
      setNeedsApproval(false);
    }
  }, [sendAmount, allowance, selectedToken]);



  function handleBridge() {
    if (!isConnected || !address) {
      setTxError('Please connect your wallet');
      return;
    }

    if (isWrongNetwork) {
      setTxError('Please switch to Ethereum mainnet');
      return;
    }

    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setTxError('Please enter a valid amount');
      return;
    }

    // Check if amount exceeds available balance
    if (Number(sendAmount) > availableBalance) {
      setTxError('Amount exceeds wallet balance');
      return;
    }

    // Check if L2 pool has sufficient balance for bridge amount
    const bridgeAmount = Number(sendAmount) * 0.95; // 95% of original amount (5% fee)
    const l2PoolAmount = l2PoolBalance ? Number(l2PoolBalance) / 10 ** DECIMALS : 0;
    
    if (bridgeAmount > l2PoolAmount) {
      setTxError(`Insufficient pool funds. Please try a smaller amount or check back later.`);
      return;
    }

    setIsBridging(true);
    setTxError(null);

    if (selectedToken.address === 'native') {
      // Handle ETH bridging
      const value = BigInt(Math.floor(Number(sendAmount) * 10 ** 18));
      writeContract({
        address: PENKMARKET_CONTRACT,
        abi: PENKMARKET_ABI,
        functionName: 'bridgeToL2',
        args: [value],
        value: value,
        chainId: CORRECT_CHAIN_ID,
      });
    } else {
      // Handle ERC20 token bridging
      let decimals = 18; // Default to 18
      if (selectedToken.symbol === 'USDC') {
        decimals = 6; // USDC has 6 decimals
      } else if (selectedToken.symbol === 'PEPU') {
        decimals = 18; // PEPU has 18 decimals
      }
      
      const amount = BigInt(Math.floor(Number(sendAmount) * 10 ** decimals));
      writeContract({
        address: PENKMARKET_CONTRACT,
        abi: PENKMARKET_ABI,
        functionName: 'bridgeToL2',
        args: [amount],
        chainId: CORRECT_CHAIN_ID,
      });
    }
  }

  useEffect(() => setIsMounted(true), []);

  // Fetch PEPU balance for connected wallet
  const { data: pepuBalance } = useReadContract({
    address: PEPU_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CORRECT_CHAIN_ID,
  });

  // Fetch USDC balance for connected wallet
  const { data: usdcBalance } = useReadContract({
    address: USDC_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CORRECT_CHAIN_ID,
  });

  // Fetch PENK balance for connected wallet (on L2)
  const { data: penkBalance, isLoading: penkLoading } = useReadContract({
    address: PENK_CONTRACT as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 97741, // Pepe Unchained V2 mainnet
  });

  const pool = l2PoolBalance ? Number(l2PoolBalance) / 10 ** DECIMALS : 0;
  const formattedPool = l2PoolBalance ? formatTokenAmount(l2PoolBalance as bigint) : "0.000";
  
  // Get current token balance based on selection
  function getCurrentTokenBalance() {
    if (!isConnected) return 0;
    
    switch (selectedToken.symbol) {
      case 'ETH':
        return nativeBalance ? Number(nativeBalance.formatted) : 0;
      case 'USDC':
        return usdcBalance ? Number(usdcBalance) / 10 ** 6 : 0; // USDC has 6 decimals
      case 'PEPU':
        return pepuBalance ? Number(pepuBalance) / 10 ** 18 : 0; // PEPU has 18 decimals
      default:
        return 0;
    }
  }

  function getCurrentTokenBalanceFormatted() {
    if (!isConnected) return "0.000";
    
    switch (selectedToken.symbol) {
      case 'ETH':
        if (nativeBalance) {
          const balance = Number(nativeBalance.formatted);
          // Show first 5 significant digits without estimation
          if (balance >= 1) {
            return balance.toFixed(4); // Show 4 decimal places for amounts >= 1
          } else if (balance >= 0.1) {
            return balance.toFixed(5); // Show 5 decimal places for amounts >= 0.1
          } else if (balance >= 0.01) {
            return balance.toFixed(6); // Show 6 decimal places for amounts >= 0.01
          } else {
            return balance.toFixed(7); // Show 7 decimal places for smaller amounts
          }
        }
        return "0.000";
      case 'USDC':
        return usdcBalance ? (Number(usdcBalance) / 10 ** 6).toLocaleString(undefined, { maximumFractionDigits: 3 }) : "0.000";
      case 'PEPU':
        return pepuBalance ? (Number(pepuBalance) / 10 ** 18).toLocaleString(undefined, { maximumFractionDigits: 3 }) : "0.000";
      default:
        return "0.000";
    }
  }

  const availableBalance = getCurrentTokenBalance();
  
  // Format PENK balance
  const formattedPenkBalance = penkBalance 
    ? (Number(penkBalance as bigint) / 10 ** DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "0";
  
  // PENK balance color class
  const penkBalanceColorClass = penkBalance && Number(penkBalance as bigint) / 10 ** DECIMALS >= PENK_MIN ? 'text-green-400' : 'text-red-400';
  
  // PENK warning condition
  const showPenkWarning = isConnected && !isWrongNetwork && !penkLoading && penkBalance && Number(penkBalance as bigint) / 10 ** DECIMALS < PENK_MIN;

  const navLinks = [
    { label: 'SuperBridge', href: '/' },
    { label: 'Penk Market', href: '/penkmarket' },
    { label: 'Transactions', href: '/penkmarket/refunds' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[1]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val || isNaN(Number(val))) {
      setSendAmount(val);
      setInputWarning('');
      setQuoteData(null); // Clear quote when amount changes
      return;
    }
    const numVal = Number(val);
    if (numVal > availableBalance) {
      setSendAmount(availableBalance.toString());
      setInputWarning('Amount exceeds wallet balance');

    } else {
      setSendAmount(val);
      setInputWarning('');
    }
    setQuoteData(null); // Clear quote when amount changes
    setNeedsApproval(false); // Reset approval state
  }

  async function checkApprovalNeeded() {
    console.log('checkApprovalNeeded called:', { address, symbol: selectedToken.symbol, sendAmount });
    
    if (!address || selectedToken.symbol === 'ETH') {
      console.log('Setting needsApproval to false - ETH or no address');
      setNeedsApproval(false);
      return;
    }

    try {
      const tokenAddress = selectedToken.symbol === 'USDC' ? USDC_CONTRACT : PEPU_CONTRACT;
      const decimals = selectedToken.symbol === 'USDC' ? 6 : 18;
      const inputAmount = BigInt(Math.floor(Number(sendAmount) * 10 ** decimals));
      
      console.log('Checking allowance:', {
        tokenAddress,
        decimals,
        sendAmount,
        inputAmount: inputAmount.toString(),
        spender: PENKMARKET_CONTRACT
      });
      
      // Check current allowance using the same pattern as the example
      const allowance = await readContract(config, {
        address: tokenAddress as `0x${string}`,
        abi: [{
          "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "spender", "type": "address" }
          ],
          "name": "allowance",
          "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
          "stateMutability": "view",
          "type": "function"
        }],
        functionName: "allowance",
        args: [address, PENKMARKET_CONTRACT],
        chainId: CORRECT_CHAIN_ID,
      }) as bigint;

      const needsApprovalResult = allowance < inputAmount;
      console.log(`Allowance check: ${allowance.toString()} >= ${inputAmount.toString()} = ${allowance >= inputAmount}`);
      console.log(`Setting needsApproval to: ${needsApprovalResult}`);
      setNeedsApproval(needsApprovalResult);
      
      // Force a re-render to ensure state is updated
      setTimeout(() => {
        console.log('State should be updated now, needsApproval:', needsApprovalResult);
      }, 100);
    } catch (error) {
      console.error('Error checking approval:', error);
      console.log('Setting needsApproval to true due to error');
      setNeedsApproval(true); // Default to needing approval if check fails
    }
  }

  async function handleGetQuote() {
    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setQuoteError('Please enter a valid amount');
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromToken: selectedToken.symbol,
          fromAmount: sendAmount,
          toToken: selectedToToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Check minimum $10 USD requirement
        if (data.data.inputUsdValue < 10) {
          setQuoteError('Minimum transaction amount is $10 USD');
          return;
        }

        // Check if L2 pool has sufficient PEPU balance
        const l2PoolAmount = l2PoolBalance ? Number(l2PoolBalance) / 10 ** DECIMALS : 0;
        const pepuEquivalent = data.data.pepuEquivalent;
        
        if (pepuEquivalent > l2PoolAmount) {
          setQuoteError(`Insufficient pool funds. Pool has ${l2PoolAmount.toFixed(6)} PEPU, but you need ${pepuEquivalent.toFixed(6)} PEPU equivalent.`);
          return;
        }

        setQuoteData(data.data);
        
        // Check if approval is needed for ERC20 tokens
        if (selectedToken.symbol === 'USDC' || selectedToken.symbol === 'PEPU') {
          console.log(`Checking approval for ${selectedToken.symbol}...`);
          console.log('About to call checkApprovalNeeded...');
          await checkApprovalNeeded();
          console.log(`After checkApprovalNeeded, needsApproval: ${needsApproval}`);
          
          // TEMPORARY: Force approval for debugging
          console.log('FORCING needsApproval to true for debugging...');
          setNeedsApproval(true);
        } else {
          console.log('Not checking approval - not USDC or PEPU');
          setNeedsApproval(false);
        }
      } else {
        setQuoteError(data.error || 'Failed to get quote');
      }
    } catch (error) {
      setQuoteError('Failed to get quote');
      console.error('Quote error:', error);
    } finally {
      setIsLoadingQuote(false);
    }
  }

  async function handleApprove() {
    if (!isConnected || !address) {
      setTxError('Please connect your wallet');
      return;
    }

    if (isWrongNetwork) {
      setTxError('Please switch to Ethereum mainnet');
      return;
    }

    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      setTxError('Please enter a valid amount');
      return;
    }

    if (selectedToken.address === 'native') {
      setTxError('ETH does not require approval');
      return;
    }

    setIsApproving(true);
    setTxError(null);
    setLastTransactionType('approval');

    try {
      const tokenAddress = selectedToken.symbol === 'USDC' ? USDC_CONTRACT : PEPU_CONTRACT;
      const decimals = selectedToken.symbol === 'USDC' ? 6 : 18;
      const amount = BigInt(Math.floor(Number(sendAmount) * 10 ** decimals));
      
      console.log('Approval amount calculation:', {
        sendAmount,
        decimals,
        amount: amount.toString()
      });
      
      await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: [{
          "inputs": [
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
          ],
          "name": "approve",
          "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
          "stateMutability": "nonpayable",
          "type": "function"
        }],
        functionName: 'approve',
        args: [PENKMARKET_CONTRACT, amount],
        chainId: CORRECT_CHAIN_ID,
        gas: BigInt(100000),
      });
      
      // Wait a bit for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Re-check approval status
      await checkApprovalNeeded();
    } catch (error) {
      setTxError('Failed to approve token spending');
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleExecuteTransaction() {
    if (!quoteData || !isConnected || !address) {
      setTxError('Please connect wallet and get a quote first');
      return;
    }

    if (isWrongNetwork) {
      setTxError('Please switch to Ethereum mainnet');
      return;
    }

    setIsBridging(true);
    setTxError(null);
    setLastTransactionType('execution');

    try {
      // Get output token address from token utilities
      const outputTokenAddress = getToTokenAddress(selectedToToken);
      if (!outputTokenAddress) {
        setTxError(`Invalid output token: ${selectedToToken}`);
        return;
      }

      // Use the user's input amount (contract handles PenkBonus internally)
      const fromTokenAmount = Number(sendAmount);
      console.log('Execute: fromTokenAmount =', fromTokenAmount);
      console.log('Execute: sendAmount =', sendAmount);

      // Check if approval is still needed for ERC20 tokens
      if (selectedToken.symbol === 'USDC' || selectedToken.symbol === 'PEPU') {
        console.log(`Execute: Checking approval for ${selectedToken.symbol}, needsApproval: ${needsApproval}`);
        if (needsApproval) {
          setTxError('Please approve token spending first');
          setIsBridging(false);
          return;
        }
        
        // Double-check approval before executing
        console.log('Execute: Double-checking approval...');
        await checkApprovalNeeded();
        console.log(`Execute: After double-check, needsApproval: ${needsApproval}`);
        if (needsApproval) {
          setTxError('Please approve token spending first');
          setIsBridging(false);
          return;
        }
      }
      
      let amount: bigint;
      
      console.log('Execute: selectedToken.symbol =', selectedToken.symbol);
      console.log('Execute: selectedToken =', selectedToken);
      
      if (selectedToken.symbol === 'ETH') {
        // For ETH, use the user's input amount converted to wei
        amount = BigInt(Math.floor(fromTokenAmount * 10 ** 18));
        
        // Call buy() function with ETH
        const gasLimit = BigInt(1000000);
        console.log('Calling buy (ETH) with:', {
          outputToken: outputTokenAddress,
          value: amount.toString(),
          gas: gasLimit.toString()
        });
        
        writeContract({
          address: PENKMARKET_CONTRACT,
          abi: [
            {
              "inputs": [
                { "name": "outputToken", "type": "address" }
              ],
              "name": "buy",
              "outputs": [],
              "stateMutability": "payable",
              "type": "function"
            }
          ],
          functionName: 'buy',
          args: [outputTokenAddress as `0x${string}`],
          value: amount,
          chainId: CORRECT_CHAIN_ID,
          gas: gasLimit, // Gas limit for ETH transactions
        });
        
      } else if (selectedToken.symbol === 'USDC') {
        // For USDC, use the user's input amount converted to USDC units (6 decimals)
        amount = BigInt(Math.floor(fromTokenAmount * 10 ** 6));
        
        // Call buyWithUSDC() function with gas limit
        const gasLimit = BigInt(1000000);
        console.log('Calling buyWithUSDC with:', {
          outputToken: outputTokenAddress,
          amount: amount.toString(),
          gas: gasLimit.toString()
        });
        
        writeContract({
          address: PENKMARKET_CONTRACT,
          abi: [
            {
              "inputs": [
                { "name": "outputToken", "type": "address" },
                { "name": "amount", "type": "uint256" }
              ],
              "name": "buyWithUSDC",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'buyWithUSDC',
          args: [outputTokenAddress as `0x${string}`, amount],
          chainId: CORRECT_CHAIN_ID,
          gas: gasLimit, // Gas limit for USDC transactions
        });
        
      } else if (selectedToken.symbol === 'PEPU') {
        // For PEPU, use the user's input amount converted to PEPU units (18 decimals)
        amount = BigInt(Math.floor(fromTokenAmount * 10 ** 18));
        console.log('PEPU amount calculation:', {
          fromTokenAmount,
          amount: amount.toString(),
          decimals: 18
        });
        
        // Call buyWithPEPU() function with gas limit
        const gasLimit = BigInt(1000000);
        console.log('Calling buyWithPEPU with:', {
          outputToken: outputTokenAddress,
          amount: amount.toString(),
          gas: gasLimit.toString()
        });
        
        writeContract({
          address: PENKMARKET_CONTRACT,
          abi: [
            {
              "inputs": [
                { "name": "outputToken", "type": "address" },
                { "name": "amount", "type": "uint256" }
              ],
              "name": "buyWithPEPU",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'buyWithPEPU',
          args: [outputTokenAddress as `0x${string}`, amount],
          chainId: CORRECT_CHAIN_ID,
          gas: gasLimit, // Gas limit for PEPU transaction
        });
      } else {
        setTxError(`Unsupported spending token: ${selectedToken.symbol}`);
        return;
      }
      
    } catch (error) {
      setTxError('Failed to execute transaction');
      console.error('Execute error:', error);
      setIsBridging(false);
    }
  }

  // Determine if bridge button should be disabled
  const bridgeAmount = sendAmount ? Number(sendAmount) * 0.95 : 0; // 95% of original amount (5% fee)
  const l2PoolAmount = l2PoolBalance ? Number(l2PoolBalance) / 10 ** DECIMALS : 0;
  const hasInsufficientL2Pool = bridgeAmount > l2PoolAmount && bridgeAmount > 0;
  
  const isBridgeDisabled = !isConnected || isWrongNetwork || isBridging || isPending || isTxLoading || !sendAmount || Number(sendAmount) <= 0 || hasInsufficientL2Pool || needsApproval;
  const isApproveDisabled = !isConnected || isWrongNetwork || isApproving || isPending || isTxLoading || !sendAmount || Number(sendAmount) <= 0;

  return (
    <div>
      {/* Navbar/Header */}
      <nav className="fixed top-0 left-0 w-full bg-[#181818] border-b border-yellow-400 z-50 flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14">
        {/* Left: Brand */}
        <div className="text-yellow-400 font-bold text-lg sm:text-xl">PenkMarket</div>
        {/* Center: Nav Links or Dropdown */}
        <div className="mx-auto">
          {/* Desktop Nav */}
          <div className="hidden sm:flex gap-3 sm:gap-6 text-xs sm:text-sm font-medium">
            {navLinks.map((link) => (
              link.href.startsWith('/') ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`transition-colors ${selectedNav.label === link.label ? 'text-yellow-400 border-b-2 border-yellow-400 pb-1' : 'text-gray-300 hover:text-yellow-400'}`}
                  onClick={() => setSelectedNav(link)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className={`transition-colors ${selectedNav.label === link.label ? 'text-yellow-400 border-b-2 border-yellow-400 pb-1' : 'text-gray-300 hover:text-yellow-400'}`}
                  onClick={() => setSelectedNav(link)}
                >
                  {link.label}
                </a>
              )
            ))}
          </div>
          {/* Mobile Dropdown */}
          <div className="relative flex sm:hidden">
            <button
              className="flex items-center gap-2 text-sm font-medium text-yellow-400 bg-[#181818] rounded px-3 py-2"
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-dropdown"
            >
              {selectedNav.label}
              <svg className={`w-4 h-4 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {mobileNavOpen && (
              <div id="mobile-nav-dropdown" className="absolute left-0 top-full mt-1 w-28 bg-[#232323] border border-gray-600 rounded shadow-lg z-10">
                {navLinks.map((link) => (
                  link.href.startsWith('/') ? (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`block px-4 py-2 text-sm ${selectedNav.label === link.label ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                      onClick={() => {
                        setSelectedNav(link);
                        setMobileNavOpen(false);
                      }}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.label}
                      href={link.href}
                      className={`block px-4 py-2 text-sm ${selectedNav.label === link.label ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                      onClick={() => {
                        setSelectedNav(link);
                        setMobileNavOpen(false);
                      }}
                    >
                      {link.label}
                    </a>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Right: Custom Connect Button */}
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, mounted }) => (
            <button
              onClick={
                !mounted
                  ? undefined
                  : !account || !chain
                  ? openConnectModal
                  : openAccountModal
              }
              type="button"
              className="bg-yellow-400 text-[#181818] font-bold px-3 py-2 sm:px-5 sm:py-2 rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <Wallet className="w-4 h-4 sm:w-4 sm:h-4" />
              <span className="block sm:hidden">{account ? 'Connected' : 'Connect'}</span>
              <span className="hidden sm:block">{account ? account.displayName : 'Connect'}</span>
            </button>
          )}
        </ConnectButton.Custom>
      </nav>
      <div
        style={{
          backgroundImage: "url('/pepubank-site-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        className="min-h-screen overflow-y-auto flex flex-col items-center justify-center pt-24 sm:pt-40 relative"
      >
        {/* Dark overlay for background */}
        <div className="absolute inset-0 bg-black opacity-60 pointer-events-none z-0" />
        {/* Main Bridge Card */}
        <div className="bg-[#181818] border-2 border-yellow-400 rounded-xl p-2 sm:p-4 w-full max-w-sm sm:max-w-[450px] shadow-lg relative mt-4 mb-4 z-10 text-xs sm:text-base">
          <h2 className="text-center text-lg sm:text-2xl font-bold text-yellow-400 mb-4 sm:mb-6">PenkMarket</h2>
          
          {/* Network Warning */}
          {isWrongNetwork && (
            <div className="bg-red-900/80 border border-red-400 rounded-lg p-3 mb-4 text-red-200 text-xs text-center">
              <div className="font-bold mb-1">⚠️ Wrong Network</div>
              <div>Please switch to Ethereum mainnet</div>
            </div>
          )}

          {/* Copy Notification */}
          {copyNotification && (
            <div className="bg-green-900/80 border border-green-400 rounded-lg p-3 mb-4 text-green-200 text-xs text-center">
              <div className="font-bold">✅ {copyNotification}</div>
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <img src="/ethereum-logo.png" alt="Ethereum" className="w-8 h-8 rounded-full" />
              <span className="text-white text-sm">From <span className="font-bold">Ethereum Mainnet</span></span>
            </div>
            <div className="flex items-center gap-2">
              <img src="/peuchain-logo.jpg" alt="Pepe Unchained V2" className="w-8 h-8 rounded-full" />
              <span className="text-white text-sm">To <span className="font-bold">Pepe Unchained V2 Mainnet</span></span>
            </div>
          </div>
          
          {/* Pool Balance Bar */}
          <div className="w-full h-5 bg-black border border-yellow-400 rounded-full mb-2 relative">
            <div className="h-full bg-green-500 rounded-full transition-all duration-700 w-full"></div>
            <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
              {isL2PoolBalanceLoading ? "..." : "POOL ACTIVE"}
            </span>
          </div>
          <div className="text-center text-white text-sm mb-6">
                         PenkMarket Pool (v1): {
               isL2PoolBalanceLoading ? 
                 <span className="font-bold">Loading...</span> : 
               !L2_POOL_CONTRACT ? 
                 <span className="font-bold text-red-500">L2 Pool Contract Not Set</span> : 
               balanceError ? 
                 <span className="font-bold text-red-500">Balance Error</span> : 
                 <span className="font-bold">{formattedPool} PEPU</span>
             }
          </div>
          
          {/* Token Selection */}
          <div className="mb-4">
            <label className="block text-white text-sm mb-2">Select Token to Spend</label>
            <div className="relative">
              <select
                value={selectedToken.symbol}
                onChange={(e) => {
                  const token = TOKEN_OPTIONS.find(t => t.symbol === e.target.value);
                  if (token) setSelectedToken(token);
                }}
                className="w-full bg-transparent border border-yellow-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none"
                disabled={!isConnected || isWrongNetwork}
              >
                {TOKEN_OPTIONS.map((token) => (
                  <option key={token.symbol} value={token.symbol} className="bg-[#181818] text-white">
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* To Token Selection */}
          <div className="mb-4">
            <label className="block text-white text-sm mb-2">Select Token to Receive</label>
            <div className="relative">
              <select
                value={selectedToToken}
                onChange={(e) => setSelectedToToken(e.target.value)}
                className="w-full bg-transparent border border-yellow-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none"
                disabled={!isConnected || isWrongNetwork}
              >
                {getToTokens().map((tokenSymbol) => (
                  <option key={tokenSymbol} value={tokenSymbol} className="bg-[#181818] text-white">
                    {tokenSymbol}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* You Send */}
          <div className="mb-2">
            <label className="block text-white text-sm mb-1">You Send</label>
            <div className={`${isConnected && !isWrongNetwork ? 'text-green-500' : 'text-red-500'} text-xs mb-1`}>
              {!isConnected ? 'Connect wallet to enter amount' : isWrongNetwork ? 'Switch to correct network' : `Enter ${selectedToken.symbol} amount to spend`}
            </div>
            <input
              type="number"
              className="w-full bg-transparent border border-yellow-400 rounded-lg px-2 py-1 text-white text-base sm:text-lg focus:outline-none placeholder:text-xs"
              value={sendAmount}
              onChange={handleInputChange}
              min="0"
              step="any"
              disabled={!isConnected || isWrongNetwork}
              placeholder="Enter amount"
            />
            {inputWarning && (
              <div className="text-red-500 text-xs mt-1">{inputWarning}</div>
            )}
            {hasInsufficientL2Pool && sendAmount && (
              <div className="text-orange-400 text-xs mt-1">
                ⚠️ Insufficient pool funds. Try a smaller amount.
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>Available:</span>
              <span className="text-white">
                {(!isConnected)
                  ? `0.000 ${selectedToken.symbol}`
                  : `${getCurrentTokenBalanceFormatted()} ${selectedToken.symbol}`}
              </span>
            </div>
            {/* PENK Balance Display */}
            {isConnected && !isWrongNetwork && (
              <div className="flex justify-between text-xs text-gray-300 mt-2">
                <span>PENK Balance (L2):</span>
                <span className={penkBalanceColorClass}>
                  {penkLoading 
                    ? "Loading..." 
                    : formattedPenkBalance}
                </span>
              </div>
            )}
          </div>
          
          {/* Approval Button */}
          {needsApproval && selectedToken.address !== 'native' && (
            <div className="relative w-full mb-4">
              <button
                className={`w-full font-bold text-sm sm:text-base py-1.5 sm:py-2 rounded-full border border-yellow-400 transition-colors ${
                  isApproveDisabled 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95'
                }`}
                disabled={isApproveDisabled}
                onClick={handleApprove}
              >
                {isApproving || isPending || isTxLoading ? 'Approving...' : `Approve ${selectedToken.symbol}`}
              </button>
            </div>
          )}
          
          {/* Get Quote Button */}
          <div className="relative w-full mb-4">
            <button
              className={`w-full font-bold text-sm sm:text-base py-1.5 sm:py-2 rounded-full border border-yellow-400 transition-colors ${
                !isConnected || isWrongNetwork || !sendAmount || Number(sendAmount) <= 0 || isLoadingQuote
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-[#16a34a] text-yellow-400 hover:bg-[#15803d] active:scale-95'
              }`}
              disabled={!isConnected || isWrongNetwork || !sendAmount || Number(sendAmount) <= 0 || isLoadingQuote}
              onClick={handleGetQuote}
            >
              {isLoadingQuote ? 'Getting Quote...' : 'Get Quote'}
            </button>
          </div>
          
          {/* Quote Error */}
          {quoteError && (
            <div className="text-red-400 text-sm mb-4 text-center">
              {quoteError}
            </div>
          )}

          {/* Quote Results */}
          {quoteData && (
            <div className="bg-[#232323] rounded-xl p-4 mb-4 text-white text-center shadow-lg">
              <div className="flex items-center justify-center mb-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-2">
                  <span className="text-black text-lg">💰</span>
                </div>
                <div className="font-bold text-lg">Quote Results</div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">You Send:</span>
                  <span className="font-bold text-yellow-300">{sendAmount} {selectedToken.symbol}</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">Input Value:</span>
                  <span className="font-bold text-yellow-300">${quoteData.inputUsdValue.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">PenkBonus (2%):</span>
                  <span className="font-bold text-yellow-400">+{(Number(sendAmount) * 0.02).toFixed(6)} {selectedToken.symbol}</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">Total Value:</span>
                  <span className="font-bold text-yellow-400">${quoteData.totalUsdValue.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">You'll Receive:</span>
                  <span className="font-bold text-yellow-300">{quoteData.tokensReceived.toFixed(6)} {selectedToToken}</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">PEPU Equivalent:</span>
                  <span className="font-bold text-yellow-300">{quoteData.pepuEquivalent.toFixed(6)} PEPU</span>
                </div>
              </div>
              
              <div className="text-xs text-gray-300 mb-4">
                💡 Prices updated in real-time from GeckoTerminal
              </div>

              {/* Approval Button */}
              {needsApproval && selectedToken.symbol !== 'ETH' && (
                <button
                  className="w-full font-bold text-sm sm:text-base py-2 rounded-full border border-yellow-400 bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-colors mb-3"
                  onClick={handleApprove}
                  disabled={isApproving || isPending || isTxLoading}
                >
                  {isApproving || isPending || isTxLoading ? 'Approving...' : `Approve ${selectedToken.symbol}`}
                </button>
              )}

              {/* Execute Button */}
              <button
                className="w-full font-bold text-sm sm:text-base py-2 rounded-full border border-yellow-400 bg-[#16a34a] text-yellow-400 hover:bg-[#15803d] active:scale-95 transition-colors"
                onClick={handleExecuteTransaction}
                disabled={isBridging || isPending || isTxLoading || needsApproval}
              >
                {isBridging || isPending || isTxLoading ? 'Executing...' : 'Execute Transaction'}
              </button>
            </div>
          )}
          
          {/* Transaction Status Messages */}
          {txError && (
            <div className="text-red-400 text-sm mb-4 text-center">
              {txError}
              {txError.includes('Minimum PENK hold') && (
                <a 
                  href={PENK_BUY_LINK} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 underline ml-1"
                >
                  Buy more PENK here
                </a>
              )}
            </div>
          )}
          
          {isTxLoading && txHash && (
            <div className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border-2 border-blue-400 rounded-xl p-4 mb-4 text-blue-100 text-center shadow-lg">
              <div className="flex items-center justify-center mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2 animate-pulse">
                  <span className="text-white text-lg">⏳</span>
                </div>
                <div className="font-bold text-lg">Transaction Pending</div>
              </div>
              
              <div className="text-sm mb-3">
                Your bridge transaction is being processed on Ethereum mainnet...
              </div>
              
              <div className="bg-black/40 rounded-lg p-2 mb-3">
                <div className="text-xs text-gray-300 mb-1">Transaction Hash:</div>
                <a 
                  href={`https://etherscan.io/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-mono text-xs text-yellow-300 hover:text-yellow-200 underline break-all"
                >
                  {txHash}
                </a>
              </div>
              
              <div className="text-xs text-gray-300">
                🔄 Please wait while we confirm your transaction...
              </div>
            </div>
          )}
          
          {successTx && (
            <div className="bg-gradient-to-r from-green-900/90 to-emerald-900/90 border-2 border-green-400 rounded-xl p-4 mb-4 text-green-100 text-center shadow-lg">
              <div className="flex items-center justify-center mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                  <span className="text-white text-lg">✓</span>
                </div>
                <div className="font-bold text-lg">Transaction Successful!</div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">Amount Spent:</span>
                  <span className="font-mono font-bold text-green-300">{successTx.original} {selectedToken.symbol}</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">You'll Receive:</span>
                  <span className="font-mono font-bold text-yellow-300">{successTx.received} {selectedToToken}</span>
                </div>
                <div className="flex justify-between items-center bg-black/30 rounded-lg p-2">
                  <span className="text-sm">PenkBonus (2%):</span>
                  <span className="font-mono text-yellow-300">+{(Number(successTx.original) * 0.02).toFixed(6)} {selectedToken.symbol}</span>
                </div>
              </div>
              
              <div className="bg-black/40 rounded-lg p-2 mb-3">
                <div className="text-xs text-gray-300 mb-1">Transaction Hash:</div>
                <a 
                  href={`https://etherscan.io/tx/${successTx.hash}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-mono text-xs text-yellow-300 hover:text-yellow-200 underline break-all"
                >
                  {successTx.hash}
                </a>
              </div>
              
              <div className="text-xs text-gray-300 mb-3">
                ⏱️ Your tokens are being processed and will be available shortly
              </div>
              
              <button 
                onClick={handleDismissSuccess} 
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
              >
                Continue Penking
              </button>
            </div>
          )}
          

            </div>
            

      </div>
    </div>
  );
}
