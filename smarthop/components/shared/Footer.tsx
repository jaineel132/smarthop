import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-12 dark:bg-black">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold tracking-tighter text-blue-500">
                SmartHop
              </span>
            </Link>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
              Mumbai Metro's smarter last-mile shared ride platform. Connecting commuters for fair, safe, and efficient travel.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              <li><Link href="#how-it-works" className="hover:text-blue-500 transition-colors">How It Works</Link></li>
              <li><Link href="/auth/signup" className="hover:text-blue-500 transition-colors">Become a Rider</Link></li>
              <li><Link href="/auth/signup?role=driver" className="hover:text-blue-500 transition-colors">Join as Driver</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-6">Account</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              <li><Link href="/auth/login" className="hover:text-blue-500 transition-colors">Login</Link></li>
              <li><Link href="/auth/signup" className="hover:text-blue-500 transition-colors">Sign Up</Link></li>
              <li><Link href="/rider/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-6">Developer</h4>
            <div className="flex flex-col space-y-4 text-sm text-slate-400">
              <p>Built for Mumbai Metro commuters</p>
              <div className="rounded-lg bg-slate-800 p-3 text-xs border border-slate-700">
                College Project 2026
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-xs text-slate-500">
          <p>© 2026 SmartHop Mumbai. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link href="#" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="#" className="hover:text-slate-300">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
