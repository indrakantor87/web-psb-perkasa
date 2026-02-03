'use client'

import { Menu, User, LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

export function Header({ user, onMenuClick }: { user: any; onMenuClick?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const isMarketing = user?.role === 'MARKETING'
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  return (
    <header className={clsx("flex h-16 items-center justify-between bg-white dark:bg-gray-800 px-4 md:px-6 shadow-sm relative z-20", !isMarketing && "transition-colors")}>
      <div className="flex items-center space-x-4">
        {onMenuClick && (
          <button
            type="button"
            className="-ml-1 text-gray-500 dark:text-gray-400 focus:outline-none"
            onClick={onMenuClick}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
        )}
        <div className="flex items-center justify-center bg-white rounded-lg p-1.5 shadow-sm border border-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/logo.png" 
            alt="PERKASA NETWORKS" 
            className="h-8 w-auto object-contain"
          />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Welcome, {user?.name}
        </h2>
      </div>
      
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={clsx("flex items-center space-x-1 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg", !isMarketing && "transition-colors")}
        >
          <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400 self-start mt-1" />
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 font-bold text-gray-600 dark:text-gray-200">
            {user?.name?.charAt(0)}
          </div>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-50">
             <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 sm:hidden">
                <p className="font-bold text-gray-900 dark:text-white">{user?.name}</p>
                <p>{user?.role}</p>
             </div>
             <Link 
               href="/profile" 
               className={clsx("block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center", !isMarketing && "transition-colors")}
               onClick={() => setIsOpen(false)}
             >
               <User className="mr-2 h-4 w-4" />
               Lihat Profil
             </Link>
             <button
                onClick={handleLogout}
                className={clsx("block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center", !isMarketing && "transition-colors")}
             >
               <LogOut className="mr-2 h-4 w-4" />
               Logout
             </button>
          </div>
        )}
      </div>
    </header>
  )
}
