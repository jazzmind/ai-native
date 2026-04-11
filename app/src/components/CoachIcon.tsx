"use client";

import {
  Target,
  Compass,
  Cpu,
  Coins,
  BarChart3,
  Scale,
  TrendingUp,
  Link,
} from "lucide-react";
import type { CoachIconName } from "@/lib/coaches";

const ICON_MAP: Record<CoachIconName, React.ComponentType<{ size?: number; className?: string }>> = {
  Target,
  Compass,
  Cpu,
  Coins,
  BarChart3,
  Scale,
  TrendingUp,
  Link,
};

interface CoachIconProps {
  name: CoachIconName | string | undefined;
  size?: number;
  className?: string;
}

export function CoachIcon({ name, size = 16, className }: CoachIconProps) {
  const Icon = name ? ICON_MAP[name as CoachIconName] : null;
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}
