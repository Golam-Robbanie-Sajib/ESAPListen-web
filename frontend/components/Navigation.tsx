'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Home, History, Settings, LogOut, Calendar, StickyNote, List, Moon, Sun, BarChart3, CheckSquare, MessageSquare } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { actualTheme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/history', label: 'History', icon: History },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/events', label: 'Events', icon: List },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/notes', label: 'Notes', icon: StickyNote },
    { href: '/queries', label: 'Queries', icon: MessageSquare },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bg-emerald-50 dark:bg-gray-800 border-b border-emerald-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-3 flex-shrink-0">
              <img
                src="/esapai_logo.png"
                alt="ESAPListen Logo"
                className="h-10 w-10 rounded-lg"
              />
              <span className="text-xl font-semibold whitespace-nowrap">
                <span className="text-green-800 dark:text-green-400">ESAP</span>
                <span className="text-green-500 dark:text-green-300">Listen</span>
              </span>
            </Link>

            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative inline-flex items-center p-2 rounded-md transition-all ${
                      isActive
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {/* Tooltip on hover */}
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              {user?.picture && (
                <Link href="/settings">
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                    title="Go to Settings"
                  />
                </Link>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                title={`Switch to ${actualTheme === 'light' ? 'dark' : 'light'} mode`}
              >
                {actualTheme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center px-3 py-2 text-xs font-medium ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
