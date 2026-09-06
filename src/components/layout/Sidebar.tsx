'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Database,
  PenLine,
  Upload,
  MessageSquare,
  ShieldCheck,
  History,
  FileText,
  Users,
  ChevronRight,
  Headphones,
  QrCode,
  PanelLeftClose,
  PanelLeft,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SubNavItem {
  label: string;
  href: string;
  badge?: number | string;
}

interface NavGroupItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  items?: SubNavItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Struktur navigasi bertingkat (Accordion groups ala RudderStack)
  const navGroups: NavGroupItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/',
      icon: <LayoutGrid size={18} />,
    },
    {
      id: 'data',
      label: 'Data Statistik',
      icon: <Database size={18} />,
      items: [
        { label: 'Katalog Dataset', href: '/datasets' },
        { label: 'Input Data Manual', href: '/input' },
        { label: 'Import Excel / CSV', href: '/import' },
      ],
    },
    {
      id: 'chatbot',
      label: 'Chatbot & CS',
      icon: <Headphones size={18} />,
      items: [
        { label: 'CS Inbox & Tiket', href: '/cs' },
        { label: 'Template Chatbot', href: '/keywords' },
        { label: 'Koneksi Host WA', href: '/whatsapp' },
      ],
    },
    {
      id: 'validation',
      label: 'Validasi & Mutu',
      icon: <ShieldCheck size={18} />,
      items: [
        { label: 'Verifikasi Data', href: '/issues' },
        { label: 'Riwayat Audit', href: '/history' },
      ],
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: <FileText size={18} />,
      items: [
        { label: 'Kamus Metadata', href: '/metadata' },
        { label: 'Manajemen Pengguna', href: '/users' },
      ],
    },
  ];

  // State untuk accordion grup yang terbuka
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    data: true,
    chatbot: false,
    validation: false,
    settings: false,
  });

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroupItem) => {
    if (group.href) return isActive(group.href);
    return group.items?.some((item) => isActive(item.href)) ?? false;
  };

  // Otomatis buka grup jika sub-itemnya sedang aktif
  useEffect(() => {
    navGroups.forEach((group) => {
      if (group.items?.some((item) => isActive(item.href))) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) {
      onToggle(); // Perluas sidebar jika sedang collapsed saat mengklik grup
    }
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderContent = () => (
    <>
      {/* 1. Header Bar: Brand Logo + Collapse Toggle Button */}
      <div className={cn('sidebar-brand', collapsed && 'sidebar-brand-collapsed')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5 w-full py-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
              <img src="/BPS.svg" alt="Logo" width={28} height={28} />
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={onToggle}
              type="button"
              title="Perluas sidebar"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                <img src="/BPS.svg" alt="Logo" width={30} height={30} />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-[15px] text-slate-900 tracking-tight">
                  SAPA BPS
                </span>
              </div>
            </div>

            {/* Tombol Collapse di pojok kanan atas */}
            <button
              className="sidebar-toggle-btn"
              onClick={onToggle}
              type="button"
              title="Ciutkan sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          </>
        )}
      </div>

      {/* 3. Nested Navigation List (Collapsible Accordion) */}
      <nav className="sidebar-nav">
        {navGroups.map((group) => {
          const groupActive = isGroupActive(group);
          const isOpen = !!openGroups[group.id];

          // Mode 1: Item Tunggal tanpa Sub-menu (contoh: Dashboard)
          if (group.href) {
            if (collapsed) {
              return (
                <Tooltip key={group.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={group.href}
                      className={cn(
                        'sidebar-collapsed-btn',
                        isActive(group.href) && 'sidebar-collapsed-btn-active'
                      )}
                      onClick={onMobileClose}
                    >
                      {group.icon}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>{group.label}</span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={group.id}
                href={group.href}
                className={cn(
                  'sidebar-link',
                  isActive(group.href) && 'sidebar-link-active'
                )}
                onClick={onMobileClose}
              >
                <span className="sidebar-link-icon">{group.icon}</span>
                <span className="sidebar-link-label">{group.label}</span>
              </Link>
            );
          }

          // Mode 2: Collapsed State untuk Group Items
          if (collapsed) {
            return (
              <Tooltip key={group.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'sidebar-collapsed-btn',
                      groupActive && 'sidebar-collapsed-btn-active'
                    )}
                    onClick={() => toggleGroup(group.id)}
                  >
                    {group.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1.5 p-2.5">
                  <div className="font-semibold text-xs text-white border-b border-slate-700 pb-1">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.items?.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onMobileClose}
                        className={cn(
                          'text-[11.5px] py-0.5 px-1.5 rounded transition-colors text-slate-300 hover:text-white hover:bg-slate-800',
                          isActive(sub.href) && 'text-blue-400 font-semibold'
                        )}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }

          // Mode 3: Expanded Accordion Group
          return (
            <div key={group.id} className="sidebar-accordion-group">
              <button
                type="button"
                className={cn(
                  'sidebar-accordion-header',
                  groupActive && 'sidebar-accordion-header-active'
                )}
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'sidebar-link-icon',
                      groupActive && 'text-blue-600'
                    )}
                  >
                    {group.icon}
                  </span>
                  <span className="sidebar-accordion-label">{group.label}</span>
                </div>
                <ChevronRight
                  size={14}
                  className={cn(
                    'text-slate-400 shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-90 text-slate-600'
                  )}
                />
              </button>

              {/* Sub-item Links (Indentasi & Active Pill ala RudderStack) */}
              {isOpen && group.items && (
                <div className="sidebar-sub-container">
                  {group.items.map((sub) => {
                    const active = isActive(sub.href);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          'sidebar-sub-item',
                          active && 'sidebar-sub-item-active'
                        )}
                        onClick={onMobileClose}
                      >
                        <span className="truncate">{sub.label}</span>
                        {sub.badge !== undefined && (
                          <span className="sidebar-link-badge">{sub.badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 4. Footer: User Profile Card (Simpel, Bersih, Sesuai Arahan) */}
      <div className="sidebar-footer">
        {!collapsed && user ? (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {user.name.charAt(0)}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        ) : user ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="sidebar-user-avatar mx-auto cursor-default">
                {user.name.charAt(0)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="font-semibold text-xs">{user.name}</div>
              <div className="text-[10px] text-slate-400">{ROLE_LABELS[user.role]}</div>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'sidebar sidebar-mobile',
          mobileOpen ? 'sidebar-mobile-open' : 'sidebar-mobile-closed'
        )}
      >
        <button
          className="sidebar-mobile-close"
          onClick={onMobileClose}
          type="button"
          title="Tutup Menu"
        >
          <X size={18} />
        </button>
        {renderContent()}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sidebar sidebar-desktop',
          collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        )}
      >
        {renderContent()}
      </aside>
    </>
  );
}

export function MobileMenuButton({
  onClick,
  isOpen = false,
}: {
  onClick: () => void;
  isOpen?: boolean;
}) {
  return (
    <button
      className="mobile-menu-btn"
      onClick={onClick}
      title={isOpen ? 'Tutup Menu' : 'Buka Menu'}
      type="button"
    >
      <LayoutGrid size={18} />
    </button>
  );
}
