'use client';

import React from 'react';
import { MorphIcon, type MorphIconProps } from 'morphicons/react';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Check,
  Circle,
  Funnel as Filter,
  FunnelX as FilterX,
  Menu,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide';

export { MorphIcon };

export interface MorphSortIconProps {
  direction: 'asc' | 'desc' | null;
  size?: number;
  className?: string;
}

export function MorphSortIcon({
  direction,
  size = 14,
  className,
}: MorphSortIconProps) {
  const icon =
    direction === 'asc'
      ? ArrowUp
      : direction === 'desc'
      ? ArrowDown
      : ArrowUpDown;

  return (
    <MorphIcon
      icon={icon}
      size={size}
      spring="snappy"
      className={className}
    />
  );
}

export interface MorphExpandIconProps {
  expanded: boolean;
  size?: number;
  className?: string;
}

export function MorphExpandIcon({
  expanded,
  size = 16,
  className,
}: MorphExpandIconProps) {
  return (
    <MorphIcon
      icon={expanded ? Minus : Plus}
      size={size}
      spring="snappy"
      className={className}
    />
  );
}

export interface MorphFilterIconProps {
  active: boolean;
  size?: number;
  className?: string;
}

export function MorphFilterIcon({
  active,
  size = 16,
  className,
}: MorphFilterIconProps) {
  return (
    <MorphIcon
      icon={active ? FilterX : Filter}
      size={size}
      spring="snappy"
      className={className}
    />
  );
}

export interface MorphToggleMenuProps {
  isOpen: boolean;
  size?: number;
  className?: string;
}

export function MorphToggleMenu({
  isOpen,
  size = 18,
  className,
}: MorphToggleMenuProps) {
  return (
    <MorphIcon
      icon={isOpen ? X : Menu}
      size={size}
      spring="snappy"
      className={className}
    />
  );
}

export interface MorphCollapseProps {
  collapsed: boolean;
  size?: number;
  className?: string;
}

export function MorphCollapseIcon({
  collapsed,
  size = 16,
  className,
}: MorphCollapseProps) {
  return (
    <MorphIcon
      icon={collapsed ? ChevronRight : ChevronLeft}
      size={size}
      spring="snappy"
      className={className}
    />
  );
}

export interface MorphVisibilityIconProps {
  visible: boolean;
  size?: number;
  className?: string;
}

export function MorphVisibilityIcon({
  visible,
  size = 16,
  className,
}: MorphVisibilityIconProps) {
  return (
    <MorphIcon
      icon={visible ? EyeOff : Eye}
      size={size}
      spring="snappy"
      className={className}
    />
  );
}
