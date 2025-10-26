'use client'

import { useState, useEffect } from 'react'
import {
  FaHome,
  FaBriefcase,
  FaWallet,
  FaMoneyBillWave,
  FaGlobe,
  FaSearch,
  FaExchangeAlt,
  FaStore,
  FaCoins,
  FaChartLine,
  FaCog,
  FaInfoCircle,
  FaQuestionCircle,
  FaExternalLinkAlt,
} from 'react-icons/fa'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SidebarMenu({
  isCollapsed = false,
  setIsCollapsed = () => {},
  onSelectItem,
  inSheet = false,
}) {
  const pathname = usePathname()
  const [selected, setSelected] = useState('')

  useEffect(() => {
    setSelected(pathname)
  }, [pathname])

  const menuItems = [
    { href: 'https://pepubank.net', icon: FaHome, label: 'Home', external: true },
    { href: '/bridge', icon: FaWallet, label: 'Bridge' },
    { href: '/transactions', icon: FaExchangeAlt, label: 'Transactions' },
    { href: '/admin', icon: FaBriefcase, label: 'Admin' },
    { href: 'https://pepubank.net/portfolio', icon: FaChartLine, label: 'Portfolio', external: true },
    { href: 'https://pepubank.net/galaxy', icon: FaGlobe, label: 'Galaxy', external: true },
    { href: 'https://pepubank.net/inspector', icon: FaSearch, label: 'Inspector', external: true },
    { href: 'https://penkmarket.pepubank.net', icon: FaStore, label: 'Penk Market', external: true },
    { href: 'https://penking.pepubank.net', icon: FaCoins, label: 'Penking', external: true },
    { href: 'https://pepubank.net/settings', icon: FaCog, label: 'Settings', external: true },
    { href: 'https://pepubank.net/about', icon: FaInfoCircle, label: 'About', external: true },
  ]

  const wrapperClass = inSheet
    ? 'w-full text-white'
    : 'fixed top-0 left-0 h-screen w-20 bg-gradient-to-b from-[#0e0e0f] to-[#0a0a0b] text-white border-r border-[#23242b] shadow-2xl backdrop-blur-sm z-[120] hidden md:flex flex-col overflow-hidden'

  return (
    <aside className={wrapperClass} aria-label="Sidebar navigation" role="navigation">
      <div className={`flex items-center ${inSheet ? 'justify-start px-4 py-4' : 'justify-center py-4 px-4'}`}>
        <a href="https://pepubank.net" target="_blank" rel="noopener noreferrer" aria-label="Go to home" onClick={onSelectItem} className="group">
          <div className="relative">
            <Image
              src="/LOGOFINAL.png"
              alt="Logo"
              width={inSheet ? 32 : 40}
              height={inSheet ? 32 : 40}
              className="opacity-100 transition-all duration-300 group-hover:scale-105 group-hover:brightness-110"
              priority
            />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400/20 to-yellow-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
          </div>
        </a>
      </div>

      <nav className={`${inSheet ? 'px-2' : 'px-3'} flex-1 flex flex-col ${inSheet ? 'gap-2' : 'gap-2'} pt-2 overflow-y-auto scrollbar-hide ${inSheet ? 'max-h-[calc(100vh-120px)]' : ''}`}>
        {menuItems.map(({ href, icon: Icon, label, external }) => {
          const LinkComponent = external ? 'a' : Link
          const linkProps = external 
            ? { href, target: '_blank', rel: 'noopener noreferrer' }
            : { href }
          
          return (
            <LinkComponent
              key={href}
              {...linkProps}
              aria-label={label}
              title={label}
              onClick={() => {
                if (!external) {
                  setSelected(href)
                }
                onSelectItem?.()
              }}
              className={
                inSheet
                  ? 'flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-all duration-200 hover:shadow-lg'
                  : 'relative group flex items-center justify-center p-1 rounded-xl transition-all duration-300 hover:bg-white/5'
              }
            >
            <div
              className={[
                'flex justify-center items-center rounded-full transition-all duration-300 shadow-lg',
                selected === href
                  ? 'bg-gradient-to-r from-green-400 to-yellow-400 shadow-green-400/25 shadow-lg'
                  : 'bg-gradient-to-br from-[#2a3b44] to-[#1e2a30] group-hover:from-[#33464f] group-hover:to-[#2a3b44] group-hover:shadow-xl group-hover:shadow-white/10',
                inSheet ? 'h-8 w-8' : 'h-10 w-10',
              ].join(' ')}
            >
              <Icon className={`text-white transition-all duration-300 ${selected === href ? 'scale-110' : 'group-hover:scale-105'}`} size={inSheet ? 16 : 18} />
            </div>

            {inSheet ? (
              <span className="ml-1 text-white text-sm font-medium">{label}</span>
            ) : (
              <span
                className="
                  pointer-events-none absolute left-[72px] top-1/2 -translate-y-1/2
                  whitespace-nowrap rounded-full bg-gradient-to-r from-[#2a3b44] to-[#1e2a30] text-white text-sm font-medium
                  py-1.5 px-3 shadow-xl border border-[#33464f]
                  opacity-0 -translate-x-3 scale-95
                  transition-all duration-300 ease-out
                  group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                "
              >
                {label}
              </span>
            )}
          </LinkComponent>
          )
        })}
      </nav>

      <div className="h-4" />
    </aside>
  )
}

