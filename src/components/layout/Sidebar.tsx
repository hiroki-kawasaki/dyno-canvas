'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUI } from '@/contexts/UIContext';

export default function Sidebar() {
    const pathname = usePathname();
    const { t, sidebarOpen } = useUI();

    if (!sidebarOpen) return null;

    const navItems = [
        {
            name: t.sidebar.dashboard,
            href: '/',
            icon: <span className="material-symbols-outlined">dashboard</span>
        },
        {
            name: t.sidebar.tables,
            href: '/tables',
            icon: <span className="material-symbols-outlined">table_chart</span>
        },
        {
            name: t.sidebar.settings,
            href: '/settings',
            icon: <span className="material-symbols-outlined">settings</span>
        }
    ];

    return (
        <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 hidden md:block flex-shrink-0">
            <div className="p-4 sticky top-0">
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group ${isActive
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <span className={`mr-3 flex items-center ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500'}`}>
                                    {item.icon}
                                </span>
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}
