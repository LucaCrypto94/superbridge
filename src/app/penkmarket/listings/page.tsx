"use client";
import React, { useState } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Wallet, ShoppingCart } from 'lucide-react';
import { getAllTokens, getTokenByAddress } from '@/lib/token-utils';

export default function Listings() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navLinks = [
    { label: 'SuperBridge', href: '/' },
    { label: 'Penk Market', href: '/penkmarket' },
    { label: 'Transactions', href: '/penkmarket/refunds' },
    { label: 'Listings', href: '/penkmarket/listings' },
    { label: 'Admin', href: '/penkmarket/tokens' },
  ];
  const [selectedNav, setSelectedNav] = useState(navLinks[3]);

  // Get all tokens from lib
  const allTokens = getAllTokens();

  // Filter tokens that have addresses (for buying)
  const buyableTokens = allTokens.filter(token => token.address);

  const getPepuSwapLink = (tokenAddress: string) => {
    return `https://pepuswap.com/#/swap?outputCurrency=${tokenAddress}`;
  };

  return (
    <div className="min-h-screen bg-[#181818]">
      {/* Header */}
      <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
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
            {/* Right: Connect Button */}
            <div className="flex items-center space-x-4">
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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Token Listings</h1>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-semibold rounded-full w-fit">
              Available to Buy
            </span>
          </div>
          <p className="text-gray-400 mt-3 text-sm sm:text-base">Browse and buy tokens available on PepuSwap</p>
        </div>

        {/* Token Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {buyableTokens.map((token) => (
            <div key={token.symbol} className="bg-gradient-to-br from-[#1a1a1a] to-[#181818] border border-gray-700/50 rounded-2xl p-4 sm:p-6 shadow-xl hover:border-yellow-400/40 hover:shadow-2xl hover:shadow-yellow-400/10 transition-all duration-300 group">
                             {/* Token Header */}
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center space-x-3">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-400/30">
                     <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                       <span className="text-[#181818] text-xs sm:text-sm font-bold">
                         {token.symbol.slice(0, 2)}
                       </span>
                     </div>
                   </div>
                   <div>
                     <h3 className="text-lg sm:text-xl font-bold text-white">{token.symbol}</h3>
                     <p className="text-xs sm:text-sm text-gray-400">ERC-20 Token</p>
                   </div>
                 </div>
                 <a
                   href={`https://etherscan.io/token/${token.address}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                 >
                   <ExternalLink className="w-4 h-4" />
                 </a>
               </div>

                             {/* Token Address */}
               <div className="mb-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                 <p className="text-xs text-gray-400 mb-2 font-medium">Contract Address</p>
                 <p className="font-mono text-xs text-gray-300 break-all leading-relaxed">
                   {token.address}
                 </p>
               </div>

                             {/* Token Note */}
               {token.note && (
                 <div className="mb-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                   <p className="text-xs text-blue-400 mb-1 font-medium">Description</p>
                   <p className="text-sm text-gray-300">{token.note}</p>
                 </div>
               )}

               {/* Buy Button */}
               <a
                 href={getPepuSwapLink(token.address!)}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#181818] font-bold py-3 px-4 rounded-xl hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl group-hover:scale-[1.02] transform text-sm sm:text-base"
               >
                 <ShoppingCart className="w-4 h-4" />
                 <span className="hidden sm:inline">Buy {token.symbol} on PepuSwap</span>
                 <span className="sm:hidden">Buy {token.symbol}</span>
               </a>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-6 sm:mt-8 bg-blue-900/20 border border-blue-400 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-3">About Token Listings</h3>
          <div className="text-gray-300 space-y-2 text-sm sm:text-base">
            <p>• <strong>Available Tokens:</strong> All tokens from the token library that have contract addresses</p>
            <p>• <strong>Buy on PepuSwap:</strong> Direct links to purchase tokens on PepuSwap DEX</p>
            <p>• <strong>Contract Addresses:</strong> View token contracts on Etherscan</p>
            <p>• <strong>Token Information:</strong> Includes token symbols, notes, and contract details</p>
          </div>
        </div>

        {/* No Tokens Message */}
        {buyableTokens.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No Tokens Available</h3>
            <p className="text-gray-400 text-sm sm:text-base">No tokens with contract addresses found in the library</p>
          </div>
        )}
      </div>
    </div>
  );
}
