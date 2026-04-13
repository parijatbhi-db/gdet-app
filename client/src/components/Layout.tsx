import type { Page } from '../App';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileOutput,
  History,
  Shield,
} from 'lucide-react';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (p: Page) => void;
  children: React.ReactNode;
}

const navItems: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'extracts', label: 'Extracts', icon: FileOutput },
  { page: 'runs', label: 'Run History', icon: History },
  { page: 'audit', label: 'Audit Log', icon: Shield },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#005DA6] text-white flex flex-col">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/20">
          <h1 className="text-2xl font-bold tracking-wide">GDET</h1>
          <p className="text-sm text-white/70 mt-1">Global Data Extract Tool</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ page, label, icon: Icon }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                currentPage === page || (currentPage === 'editor' && page === 'extracts')
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/20 text-xs text-white/50">
          Arrow Electronics
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
