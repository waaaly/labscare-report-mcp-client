'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FlaskConical,
  FolderKanban,
  FileText,
  Database,
  Code,
  BookOpen,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: FlaskConical },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'LIMS Data', href: '/lims', icon: Database },
  { name: 'Scripts', href: '/scripts', icon: Code },
  { name: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Members', href: '/members', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">LabFlow</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        {!collapsed && (
          <div className="text-xs text-muted-foreground">
            <p>LabFlow MCP Studio</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        )}
      </div>
    </div>
  );
}
