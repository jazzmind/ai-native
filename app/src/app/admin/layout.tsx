"use client";

import { usePathname } from "next/navigation";
import { AdminGuard } from "@/components/AdminGuard";

const OPEN_ROUTES = ["/admin/setup", "/admin/targets"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isOpenRoute = pathname === "/admin" || OPEN_ROUTES.some(r => pathname.startsWith(r));

  if (isOpenRoute) {
    return <>{children}</>;
  }

  return <AdminGuard>{children}</AdminGuard>;
}
