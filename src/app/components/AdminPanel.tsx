'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AlertTriangle, Copy } from 'lucide-react';
import Link from 'next/link';

const L1_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L1_ADDRESS as `0x${string}`;
const L2_CONTRACT = process.env.NEXT_PUBLIC_SUPERBRIDGE_L2_ADDRESS as `0x${string}`;

const L1_ABI = [
  { "inputs": [], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "paused", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "TOKEN", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getBalance", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "emergencyWithdrawTime", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "emergencyWithdrawDelay", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "", "type": "address" }], "name": "emergencyOperators", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "emergencyPause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "initiateEmergencyWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "token", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "executeEmergencyWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "operator", "type": "address" }, { "name": "status", "type": "bool" }], "name": "setEmergencyOperator", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "newToken", "type": "address" }], "name": "updateToken", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const L2_ABI = [
  { "inputs": [], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "paused", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "feeRecipient", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "feeBps", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "FUNDS_RECIPIENT", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "numSigners", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "", "type": "address" }], "name": "emergencyOperators", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "", "type": "address" }], "name": "isFeeExempt", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "", "type": "address" }], "name": "isValidSigner", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "emergencyPause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "operator", "type": "address" }, { "name": "status", "type": "bool" }], "name": "setEmergencyOperator", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "user", "type": "address" }, { "name": "exempt", "type": "bool" }], "name": "setFeeExempt", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "validator", "type": "address" }, { "name": "isValid", "type": "bool" }], "name": "setValidator", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "_feeRecipient", "type": "address" }], "name": "setFeeRecipient", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "_feeBps", "type": "uint256" }], "name": "setFeeBps", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AdminPanel() {
  const { address, isConnected } = useAccount();
  const [selectedContract, setSelectedContract] = useState<'L1' | 'L2'>('L1');
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [newOperatorAddress, setNewOperatorAddress] = useState('');
  const [operatorStatus, setOperatorStatus] = useState(true);
  const [feeExemptAddress, setFeeExemptAddress] = useState('');
  const [feeExemptStatus, setFeeExemptStatus] = useState(true);
  const [validatorAddress, setValidatorAddress] = useState('');
  const [validatorStatus, setValidatorStatus] = useState(true);
  const [feeRecipientAddress, setFeeRecipientAddress] = useState('');
  const [newFeeBps, setNewFeeBps] = useState('');
  const [selectedFunction, setSelectedFunction] = useState<string>('');

  // L1 Contract reads (Ethereum Mainnet)
  const { data: l1Owner } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "owner",
    chainId: 1,
  });

  const { data: isL1Paused } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "paused",
    chainId: 1,
  });

  const { data: l1TokenAddress } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "TOKEN",
    chainId: 1,
  });

  const { data: l1ContractBalance } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "getBalance",
    chainId: 1,
  });

  const { data: l1EmergencyWithdrawTime } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "emergencyWithdrawTime",
    chainId: 1,
  });

  const { data: l1EmergencyWithdrawDelay } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "emergencyWithdrawDelay",
    chainId: 1,
  });

  // L2 Contract reads (Pepe Unchained V2)
  const { data: l2Owner } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "owner",
    chainId: 97741,
  });

  const { data: isL2Paused } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "paused",
    chainId: 97741,
  });

  const { data: l2FeeRecipient } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "feeRecipient",
    chainId: 97741,
  });

  const { data: l2FeeBps } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "feeBps",
    chainId: 97741,
  });

  const { data: l2EmergencyWithdrawTime } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "emergencyWithdrawTime",
    chainId: 97741,
  });

  const { data: l2EmergencyWithdrawDelay } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "emergencyWithdrawDelay",
    chainId: 97741,
  });

  // Additional L2 reads for current state
  const { data: l2NumSigners } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "numSigners",
    chainId: 97741,
  });

  const { data: l2FundsRecipient } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "FUNDS_RECIPIENT",
    chainId: 97741,
  });

  // Read current emergency operators
  const { data: isL1EmergencyOperator } = useReadContract({
    address: L1_CONTRACT,
    abi: L1_ABI,
    functionName: "emergencyOperators",
    args: [address as `0x${string}`],
    chainId: 1,
  });

  const { data: isL2EmergencyOperator } = useReadContract({
    address: L2_CONTRACT,
    abi: L2_ABI,
    functionName: "emergencyOperators",
    args: [address as `0x${string}`],
    chainId: 97741,
  });

  // Write contracts
  const { writeContract: writeL1, isPending: isL1Pending } = useWriteContract();
  const { writeContract: writeL2, isPending: isL2Pending } = useWriteContract();

  // Check if user is admin
  useEffect(() => {
    if (address && l1Owner) {
      setIsAdmin(address.toLowerCase() === String(l1Owner).toLowerCase());
    } else {
      setIsAdmin(false);
    }
  }, [address, l1Owner]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotification(`${label} copied!`);
    setTimeout(() => setCopyNotification(null), 2000);
  };

  const handlePause = () => {
    if (selectedContract === 'L1') {
      writeL1({
        address: L1_CONTRACT,
        abi: L1_ABI,
        functionName: 'emergencyPause',
        chainId: 1,
      });
    } else {
      writeL2({
        address: L2_CONTRACT,
        abi: L2_ABI,
        functionName: 'emergencyPause',
        chainId: 97741,
      });
    }
  };

  const handleUnpause = () => {
    if (selectedContract === 'L1') {
      writeL1({
        address: L1_CONTRACT,
        abi: L1_ABI,
        functionName: 'unpause',
        chainId: 1,
      });
    } else {
      writeL2({
        address: L2_CONTRACT,
        abi: L2_ABI,
        functionName: 'unpause',
        chainId: 97741,
      });
    }
  };

  const handleInitiateEmergencyWithdraw = () => {
    if (selectedContract === 'L1') {
      writeL1({
        address: L1_CONTRACT,
        abi: L1_ABI,
        functionName: 'initiateEmergencyWithdraw',
        chainId: 1,
      });
    } else {
      writeL2({
        address: L2_CONTRACT,
        abi: L2_ABI,
        functionName: 'initiateEmergencyWithdraw',
        chainId: 97741,
      });
    }
  };

  const handleExecuteEmergencyWithdraw = () => {
    if (selectedContract === 'L1' && l1TokenAddress && l1ContractBalance) {
      writeL1({
        address: L1_CONTRACT,
        abi: L1_ABI,
        functionName: 'executeEmergencyWithdraw',
        args: [l1TokenAddress, l1ContractBalance],
        chainId: 1,
      });
    } else if (selectedContract === 'L2') {
      writeL2({
        address: L2_CONTRACT,
        abi: L2_ABI,
        functionName: 'executeEmergencyWithdraw',
        chainId: 97741,
      });
    }
  };

  const handleSetEmergencyOperator = () => {
    if (!newOperatorAddress) {
      alert('Please enter operator address');
      return;
    }
    
    if (selectedContract === 'L1') {
      writeL1({
        address: L1_CONTRACT,
        abi: L1_ABI,
        functionName: 'setEmergencyOperator',
        args: [newOperatorAddress as `0x${string}`, operatorStatus],
        chainId: 1,
      });
    } else {
      writeL2({
        address: L2_CONTRACT,
        abi: L2_ABI,
        functionName: 'setEmergencyOperator',
        args: [newOperatorAddress as `0x${string}`, operatorStatus],
        chainId: 97741,
      });
    }
  };

  const handleUpdateToken = () => {
    if (!newTokenAddress) {
      alert('Please enter new token address');
      return;
    }
    
    writeL1({
      address: L1_CONTRACT,
      abi: L1_ABI,
      functionName: 'updateToken',
      args: [newTokenAddress as `0x${string}`],
      chainId: 1,
    });
  };

  const handleSetFeeExempt = () => {
    if (!feeExemptAddress) {
      alert('Please enter address');
      return;
    }
    
    writeL2({
      address: L2_CONTRACT,
      abi: L2_ABI,
      functionName: 'setFeeExempt',
      args: [feeExemptAddress as `0x${string}`, feeExemptStatus],
      chainId: 97741,
    });
  };

  const handleSetValidator = () => {
    if (!validatorAddress) {
      alert('Please enter validator address');
      return;
    }
    
    writeL2({
      address: L2_CONTRACT,
      abi: L2_ABI,
      functionName: 'setValidator',
      args: [validatorAddress as `0x${string}`, validatorStatus],
      chainId: 97741,
    });
  };

  const handleSetFeeRecipient = () => {
    if (!feeRecipientAddress) {
      alert('Please enter fee recipient address');
      return;
    }
    
    writeL2({
      address: L2_CONTRACT,
      abi: L2_ABI,
      functionName: 'setFeeRecipient',
      args: [feeRecipientAddress as `0x${string}`],
      chainId: 97741,
    });
  };

  const handleSetFeeBps = () => {
    if (!newFeeBps) {
      alert('Please enter fee BPS');
      return;
    }
    
    const feeBpsValue = parseInt(newFeeBps);
    if (feeBpsValue < 0 || feeBpsValue > 1000) {
      alert('Fee BPS must be between 0 and 1000 (0% to 10%)');
      return;
    }
    
    writeL2({
      address: L2_CONTRACT,
      abi: L2_ABI,
      functionName: 'setFeeBps',
      args: [BigInt(feeBpsValue)],
      chainId: 97741,
    });
  };

  const navLinks = [
    { label: 'About', href: '/' },
    { label: 'Bridge', href: '/' },
    { label: 'Pools', href: '/' },
    { label: 'Transactions', href: '/transactions' },
    { label: 'Admin', href: '/admin' },
    { label: 'Explorer', href: '/' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[4]); // Admin is selected
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar/Header */}
      <nav className="fixed top-0 left-0 w-full bg-[#181818] border-b border-yellow-400 z-50 flex items-center justify-between px-3 sm:px-6 h-12 sm:h-14">
        {/* Left: Brand */}
        <div className="text-yellow-400 font-bold text-lg sm:text-xl">SuperBridge</div>
        {/* Center: Nav Links or Dropdown */}
        <div className="mx-auto">
          {/* Desktop Nav */}
          <div className="hidden sm:flex gap-3 sm:gap-6 text-xs sm:text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`transition-colors ${selectedNav.label === link.label ? 'text-yellow-400 border-b-2 border-yellow-400 pb-1' : 'text-gray-300 hover:text-yellow-400'}`}
                onClick={() => setSelectedNav(link)}
              >
                {link.label}
              </Link>
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
              <div id="mobile-nav-dropdown" className="absolute left-0 top-full mt-1 w-32 bg-[#232323] border border-gray-600 rounded shadow-lg z-10">
                {navLinks.map((link) => (
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
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Right: Connect Button */}
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            mounted,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  style: {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Connect Wallet
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        type="button"
                        className="bg-red-500 hover:bg-red-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Wrong network
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={openAccountModal}
                      type="button"
                      className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      {account.displayName}
                    </button>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pt-16 sm:pt-20">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-sm sm:text-base text-gray-400">Manage your SuperBridge contracts</p>
        </div>

        {/* Contract Selection */}
        <div className="bg-[#232323] border border-gray-600 rounded-xl p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Select Contract</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setSelectedContract('L1')}
              className={`px-4 sm:px-6 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                selectedContract === 'L1'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              L1 Contract (Ethereum)
            </button>
            <button
              onClick={() => setSelectedContract('L2')}
              className={`px-4 sm:px-6 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                selectedContract === 'L2'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              L2 Contract (Pepe Unchained)
            </button>
          </div>
        </div>

        {/* Contract Info */}
        <div className="bg-[#232323] border border-gray-600 rounded-xl p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
            {selectedContract} Contract Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Contract Address</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs sm:text-sm text-yellow-300 font-mono bg-black/30 px-2 sm:px-3 py-2 rounded flex-1 break-all">
                  {selectedContract === 'L1' ? L1_CONTRACT : L2_CONTRACT}
                </code>
                <button
                  onClick={() => copyToClipboard(selectedContract === 'L1' ? L1_CONTRACT : L2_CONTRACT, `${selectedContract} Contract address`)}
                  className="text-yellow-400 hover:text-yellow-300 p-2 rounded border border-yellow-400 hover:bg-yellow-400/10 transition-colors flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-sm text-gray-400">Your Role</label>
                <div className="text-sm text-white mt-1">
                  {isAdmin ? 'OWNER' : 'USER'}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Owner Address</label>
                <div className="text-sm text-white mt-1">
                  {selectedContract === 'L1' ? shortenAddress(String(l1Owner) || '') : shortenAddress(String(l2Owner) || '')}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Contract Status</label>
                <div className="text-sm text-white mt-1">
                  {selectedContract === 'L1' ? (Boolean(isL1Paused) ? 'PAUSED' : 'ACTIVE') : (Boolean(isL2Paused) ? 'PAUSED' : 'ACTIVE')}
                </div>
              </div>
              {selectedContract === 'L1' && (
                <div>
                  <label className="text-sm text-gray-400">Token Balance</label>
                  <div className="text-sm text-white mt-1">
                    {l1ContractBalance ? `${Number(l1ContractBalance as bigint) / 10 ** 18} PEPU` : '0 PEPU'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin Functions */}
        {isAdmin && (
          <div className="bg-[#232323] border border-red-400 rounded-xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Admin Functions
            </h2>
            
            {/* Contract State Display */}
            <div className="mb-6 p-3 sm:p-4 bg-black/30 border border-yellow-400 rounded-lg">
              <h3 className="text-base sm:text-lg font-semibold text-yellow-400 mb-3">📊 Current Contract State</h3>
              
              {selectedContract === 'L1' ? (
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Status:</span>
                    <span className={Boolean(isL1Paused) ? "text-red-400" : "text-green-400"}>
                      {Boolean(isL1Paused) ? "⏸️ Paused" : "✅ Active"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Token Address:</span>
                    <span className="text-white font-mono text-xs break-all">
                      {l1TokenAddress ? shortenAddress(String(l1TokenAddress)) : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Token Balance:</span>
                    <span className="text-white">
                      {l1ContractBalance ? `${Number(l1ContractBalance as bigint) / 1e18} PEPU` : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Emergency Withdraw Time:</span>
                    <span className="text-white text-xs sm:text-sm">
                      {l1EmergencyWithdrawTime && Number(l1EmergencyWithdrawTime) > 0 
                        ? new Date(Number(l1EmergencyWithdrawTime) * 1000).toLocaleString()
                        : "Not initiated"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Emergency Withdraw Delay:</span>
                    <span className="text-white">
                      {l1EmergencyWithdrawDelay ? `${Number(l1EmergencyWithdrawDelay) / 3600} hours` : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Your Emergency Operator:</span>
                    <span className={Boolean(isL1EmergencyOperator) ? "text-green-400" : "text-red-400"}>
                      {Boolean(isL1EmergencyOperator) ? "✅ Yes" : "❌ No"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Status:</span>
                    <span className={Boolean(isL2Paused) ? "text-red-400" : "text-green-400"}>
                      {Boolean(isL2Paused) ? "⏸️ Paused" : "✅ Active"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Fee Recipient:</span>
                    <span className="text-white font-mono text-xs break-all">
                      {l2FeeRecipient ? shortenAddress(String(l2FeeRecipient)) : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Fee BPS:</span>
                    <span className="text-white">
                      {l2FeeBps ? `${Number(l2FeeBps)} (${(Number(l2FeeBps) / 100).toFixed(2)}%)` : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Funds Recipient:</span>
                    <span className="text-white font-mono text-xs break-all">
                      {l2FundsRecipient ? shortenAddress(String(l2FundsRecipient)) : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Number of Signers:</span>
                    <span className="text-white">
                      {l2NumSigners ? Number(l2NumSigners) : "Loading..."}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-400">Your Emergency Operator:</span>
                    <span className={Boolean(isL2EmergencyOperator) ? "text-green-400" : "text-red-400"}>
                      {Boolean(isL2EmergencyOperator) ? "✅ Yes" : "❌ No"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Function Selection */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Select Function</label>
              <select
                value={selectedFunction}
                onChange={(e) => setSelectedFunction(e.target.value)}
                className="w-full px-3 sm:px-4 py-3 bg-black border-2 border-yellow-400 rounded-lg text-white text-sm focus:border-yellow-300 focus:outline-none transition-colors"
              >
                <option value="">Choose a function...</option>
                
                {/* L1 Functions Only */}
                {selectedContract === 'L1' && (
                  <>
                    <option value="emergencyPause">🚨 Emergency Pause</option>
                    <option value="unpause">✅ Unpause</option>
                    <option value="setEmergencyOperator">👤 Set Emergency Operator</option>
                    <option value="initiateEmergencyWithdraw">⏰ Initiate Emergency Withdraw</option>
                    <option value="executeEmergencyWithdraw">💰 Execute Emergency Withdraw</option>
                    <option value="updateToken">🔄 Update Token Address</option>
                  </>
                )}
                
                {/* L2 Functions Only */}
                {selectedContract === 'L2' && (
                  <>
                    <option value="emergencyPause">🚨 Emergency Pause</option>
                    <option value="unpause">✅ Unpause</option>
                    <option value="setEmergencyOperator">👤 Set Emergency Operator</option>
                    <option value="setFeeExempt">💸 Set Fee Exempt</option>
                    <option value="setValidator">🔐 Set Validator</option>
                    <option value="setFeeRecipient">🎯 Set Fee Recipient</option>
                    <option value="setFeeBps">💰 Set Fee BPS</option>
                  </>
                )}
              </select>
            </div>

            {/* Show selected function */}
            {selectedFunction && (
              <div className="space-y-4">
                {/* L1 Functions */}
                {selectedContract === 'L1' && (
                  <>
                    {/* Emergency Pause - L1 */}
                    {selectedFunction === 'emergencyPause' && (
                      <div className="bg-red-900/20 border border-red-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-red-400 mb-3">🚨 Emergency Pause L1</h3>
                        <p className="text-sm text-gray-400 mb-3">Pause the L1 contract (Emergency Operators only)</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handlePause}
                            disabled={isL1Pending}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL1Pending ? 'Processing...' : 'Emergency Pause L1'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unpause - L1 */}
                    {selectedFunction === 'unpause' && (
                      <div className="bg-green-900/20 border border-green-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Unpause L1</h3>
                        <p className="text-sm text-gray-400 mb-3">Unpause the L1 contract (Owner only)</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleUnpause}
                            disabled={isL1Pending}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL1Pending ? 'Processing...' : 'Unpause L1'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Set Emergency Operator - L1 */}
                    {selectedFunction === 'setEmergencyOperator' && (
                      <div className="bg-indigo-900/20 border border-indigo-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-indigo-400 mb-3">👤 Set Emergency Operator L1</h3>
                        <p className="text-sm text-gray-400 mb-3">Add or remove emergency operators for L1 (Owner only)</p>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">Operator Address</label>
                            <input
                              type="text"
                              value={newOperatorAddress}
                              onChange={(e) => setNewOperatorAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400">Status</label>
                            <select
                              value={operatorStatus.toString()}
                              onChange={(e) => setOperatorStatus(e.target.value === 'true')}
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            >
                              <option value="true">Operator</option>
                              <option value="false">Not Operator</option>
                            </select>
                          </div>
                          <button
                            onClick={handleSetEmergencyOperator}
                            disabled={isL1Pending || !newOperatorAddress}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL1Pending ? 'Processing...' : 'Set L1 Operator'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Initiate Emergency Withdraw - L1 */}
                    {selectedFunction === 'initiateEmergencyWithdraw' && (
                      <div className="bg-orange-900/20 border border-orange-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-orange-400 mb-3">⏰ Initiate Emergency Withdraw L1</h3>
                        <p className="text-sm text-gray-400 mb-3">Start 24-hour emergency withdrawal timer for L1 (Emergency Operators only)</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleInitiateEmergencyWithdraw}
                            disabled={isL1Pending}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL1Pending ? 'Processing...' : 'Initiate L1 Withdraw'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Execute Emergency Withdraw - L1 */}
                    {selectedFunction === 'executeEmergencyWithdraw' && (
                      <div className="bg-red-900/20 border border-red-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-red-400 mb-3">💰 Execute Emergency Withdraw L1</h3>
                        <p className="text-sm text-gray-400 mb-3">Execute emergency withdrawal for L1 after 24-hour delay (Owner only)</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleExecuteEmergencyWithdraw}
                            disabled={isL1Pending}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL1Pending ? 'Processing...' : 'Execute L1 Withdraw'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Update Token - L1 Only */}
                    {selectedFunction === 'updateToken' && (
                      <div className="bg-blue-900/20 border border-blue-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-blue-400 mb-3">🔄 Update Token Address L1</h3>
                        <p className="text-sm text-gray-400 mb-3">Change the PEPU token address on L1 (Owner only)</p>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">New Token Address</label>
                            <input
                              type="text"
                              value={newTokenAddress}
                              onChange={(e) => setNewTokenAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                          </div>
                          <button
                            onClick={handleUpdateToken}
                            disabled={isL1Pending || !newTokenAddress}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL1Pending ? 'Processing...' : 'Update L1 Token'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* L2 Functions */}
                {selectedContract === 'L2' && (
                  <>
                    {/* Emergency Pause - L2 */}
                    {selectedFunction === 'emergencyPause' && (
                      <div className="bg-red-900/20 border border-red-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-red-400 mb-3">🚨 Emergency Pause L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Pause the L2 contract (Emergency Operators only)</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handlePause}
                            disabled={isL2Pending}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Emergency Pause L2'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unpause - L2 */}
                    {selectedFunction === 'unpause' && (
                      <div className="bg-green-900/20 border border-green-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Unpause L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Unpause the L2 contract (Owner only)</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleUnpause}
                            disabled={isL2Pending}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Unpause L2'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Set Emergency Operator - L2 */}
                    {selectedFunction === 'setEmergencyOperator' && (
                      <div className="bg-indigo-900/20 border border-indigo-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-indigo-400 mb-3">👤 Set Emergency Operator L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Add or remove emergency operators for L2 (Owner only)</p>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">Operator Address</label>
                            <input
                              type="text"
                              value={newOperatorAddress}
                              onChange={(e) => setNewOperatorAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400">Status</label>
                            <select
                              value={operatorStatus.toString()}
                              onChange={(e) => setOperatorStatus(e.target.value === 'true')}
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            >
                              <option value="true">Operator</option>
                              <option value="false">Not Operator</option>
                            </select>
                          </div>
                          <button
                            onClick={handleSetEmergencyOperator}
                            disabled={isL2Pending || !newOperatorAddress}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Set L2 Operator'}
                          </button>
                        </div>
                      </div>
                    )}



                    {/* Set Fee Exempt - L2 Only */}
                    {selectedFunction === 'setFeeExempt' && (
                      <div className="bg-green-900/20 border border-green-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-green-400 mb-3">💸 Set Fee Exempt L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Make addresses exempt from 5% bridge fee on L2 (Owner only)</p>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">Address</label>
                            <input
                              type="text"
                              value={feeExemptAddress}
                              onChange={(e) => setFeeExemptAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400">Status</label>
                            <select
                              value={feeExemptStatus.toString()}
                              onChange={(e) => setFeeExemptStatus(e.target.value === 'true')}
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            >
                              <option value="true">Exempt</option>
                              <option value="false">Not Exempt</option>
                            </select>
                          </div>
                          <button
                            onClick={handleSetFeeExempt}
                            disabled={isL2Pending || !feeExemptAddress}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Set L2 Fee Exempt'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Set Validator - L2 Only */}
                    {selectedFunction === 'setValidator' && (
                      <div className="bg-purple-900/20 border border-purple-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-purple-400 mb-3">🔐 Set Validator L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Add or remove signature validators on L2 (Owner only)</p>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">Validator Address</label>
                            <input
                              type="text"
                              value={validatorAddress}
                              onChange={(e) => setValidatorAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400">Status</label>
                            <select
                              value={validatorStatus.toString()}
                              onChange={(e) => setValidatorStatus(e.target.value === 'true')}
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            >
                              <option value="true">Valid</option>
                              <option value="false">Invalid</option>
                            </select>
                          </div>
                          <button
                            onClick={handleSetValidator}
                            disabled={isL2Pending || !validatorAddress}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Set L2 Validator'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Set Fee Recipient - L2 Only */}
                    {selectedFunction === 'setFeeRecipient' && (
                      <div className="bg-yellow-900/20 border border-yellow-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-yellow-400 mb-3">🎯 Set Fee Recipient L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Change the fee recipient address on L2 (Owner only)</p>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">Fee Recipient Address</label>
                            <input
                              type="text"
                              value={feeRecipientAddress}
                              onChange={(e) => setFeeRecipientAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                          </div>
                          <button
                            onClick={handleSetFeeRecipient}
                            disabled={isL2Pending || !feeRecipientAddress}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Set L2 Fee Recipient'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Set Fee BPS - L2 Only */}
                    {selectedFunction === 'setFeeBps' && (
                      <div className="bg-blue-900/20 border border-blue-400 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-blue-400 mb-3">💰 Set Fee BPS L2</h3>
                        <p className="text-sm text-gray-400 mb-3">Change the bridge fee percentage on L2 (Owner only, max 10%)</p>
                        <div className="mb-3 p-3 bg-black/30 border border-blue-400 rounded">
                          <div className="text-sm text-blue-300">
                            <strong>Current Fee:</strong> {l2FeeBps ? `${Number(l2FeeBps)} BPS (${(Number(l2FeeBps) / 100).toFixed(2)}%)` : "Loading..."}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Fee BPS range: 0-1000 (0% to 10%)
                          </div>
                        </div>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-sm text-gray-400">New Fee BPS</label>
                            <input
                              type="number"
                              value={newFeeBps}
                              onChange={(e) => setNewFeeBps(e.target.value)}
                              placeholder="500"
                              min="0"
                              max="1000"
                              className="w-full mt-1 px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm"
                            />
                            <div className="text-xs text-gray-400 mt-1">
                              Example: 500 = 5%, 1000 = 10%
                            </div>
                          </div>
                          <button
                            onClick={handleSetFeeBps}
                            disabled={isL2Pending || !newFeeBps}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                          >
                            {isL2Pending ? 'Processing...' : 'Set L2 Fee BPS'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Copy Notification */}
        {copyNotification && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {copyNotification}
          </div>
        )}
      </main>
    </div>
  );
} 