'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Bot,
  Database,
  FlaskConical,
  KeyRound,
  Cpu,
  Radio,
  Activity,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Overview', href: '/overview', icon: LayoutDashboard },
      { label: 'Projects', href: '/projects', icon: FolderKanban },
    ],
  },
  {
    title: 'DEVELOPMENT',
    items: [
      { label: 'Prompts', href: '/prompts', icon: MessageSquare },
      { label: 'Agents', href: '/agents', icon: Bot },
      { label: 'Datasets', href: '/datasets', icon: Database },
    ],
  },
  {
    title: 'DEPLOYMENT',
    items: [
      { label: 'Evaluations', href: '/evaluations', icon: FlaskConical },
      { label: 'AI Providers', href: '/ai-providers', icon: Cpu },
      { label: 'API Keys', href: '/api-keys', icon: KeyRound },
      { label: 'API Gateway', href: '/api-gateway', icon: Radio },
      { label: 'Live Monitoring', href: '/live-monitoring', icon: Activity },
      { label: 'API Calls', href: '/api-calls', icon: PhoneCall },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const width = collapsed ? 'w-16' : 'w-60';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-200',
          width,
        )}
      >
        {/* Workspace switcher */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navSections.map((section) => (
            <div key={section.title} className="mb-2">
              {!collapsed && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {section.title}
                </p>
              )}
              {collapsed && <Separator className="my-2 bg-sidebar-border" />}
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-md transition-colors mx-auto',
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground',
                          )}
                          aria-label={item.label}
                        >
                          <Icon className="h-4 w-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                      isActive
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: user + collapse */}
        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between')}
          >
            <UserButton afterSignOutUrl="/sign-in" />
            {!collapsed && (
              <span className="ml-2 flex-1 text-xs text-sidebar-foreground/50 truncate">
                Account
              </span>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-white/10 hover:text-sidebar-foreground transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
