'use client';

import { FlaskConical, Search, Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LabSwitcher from './lab-switcher';
import { LangSwitcher } from './lang-switcher';
import { useEffect, useRef } from 'react';

export function Header() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => {
      const h = ref.current?.offsetHeight ?? 64;
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return (
    <header ref={ref} className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">LabFlow MCP Studio</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <LabSwitcher />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search... (Cmd+K)"
            className="w-64 pl-9"
          />
        </div>
        <LangSwitcher />
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
