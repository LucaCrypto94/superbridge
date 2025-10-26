"use client";
import Transactions from '../components/Transactions';
import SidebarMenu from '../components/SidebarMenu';
import { useState } from 'react';
import { FaBars } from 'react-icons/fa';

export default function TransactionsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0e0e0f]">
      {/* Sidebar */}
      <SidebarMenu onSelectItem={() => {}} />
      
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:fixed md:top-4 md:left-2 md:z-50 md:hidden bg-gradient-to-r from-orange-500 to-pink-500 text-white p-3 rounded-xl shadow-lg hover:scale-105 transition-all mb-4 ml-4 mt-2"
      >
        <FaBars size={18} />
      </button>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-80 h-full bg-gradient-to-b from-[#0e0e0f] to-[#0a0a0b] border-r border-[#23242b] overflow-y-auto scrollbar-hide">
            <SidebarMenu inSheet={true} onSelectItem={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="md:ml-20">
        <Transactions />
      </div>
    </div>
  );
} 