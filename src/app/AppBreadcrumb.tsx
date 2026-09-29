"use client";

import { HomeOutlined } from "@ant-design/icons";
import { Breadcrumb } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const PATH_LABELS: Record<string, string> = {
  "/orders": "Orders",
  "/orders/create": "Create order",
  "/shipments": "Shipments",
  "/movements": "Movements",
  "/sales": "Sales",
  "/sales/sync-status": "Sync status",
  "/sales/daily-sales": "Daily sales",
  "/sales/dashboard": "Dashboard",
  "/sales/profit-summary": "Profit summary",
  "/employees": "Employees",
  "/timesheets": "Timesheets",
  "/timesheets/tracker": "Tracker",
  "/loyverse": "Loyverse",
  "/loyverse/daily-sales": "Daily sales",
};

const NAVIGABLE_PATHS = new Set([
  "/",
  "/orders",
  "/orders/create",
  "/shipments",
  "/movements",
  "/sales",
  "/sales/sync-status",
  "/sales/daily-sales",
  "/sales/dashboard",
  "/sales/profit-summary",
  "/employees",
  "/timesheets",
  "/timesheets/tracker",
  "/loyverse/daily-sales",
]);

export function AppBreadcrumb() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const items: Array<{ title: ReactNode }> = [
    {
      title: (
        <Link href="/">
          <HomeOutlined /> <span>Home</span>
        </Link>
      ),
    },
  ];

  if (pathname === "/shipments" || pathname.startsWith("/shipments/")) {
    items.push({ title: <Link href="/orders">Orders</Link> });
  }

  segments.forEach((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    const label = PATH_LABELS[path] || dynamicLabel(segments[index - 1], segment);
    const isCurrentPage = index === segments.length - 1;
    items.push({
      title:
        !isCurrentPage && NAVIGABLE_PATHS.has(path) ? (
          <Link href={path}>{label}</Link>
        ) : (
          label
        ),
    });
  });

  return (
    <nav aria-label="Breadcrumb" className="app-breadcrumb-shell">
      <Breadcrumb className="app-breadcrumb" items={items} />
    </nav>
  );
}

function dynamicLabel(parent: string | undefined, segment: string): string {
  const value = safeDecode(segment);
  if (parent === "orders") return `Order ${value}`;
  if (parent === "shipments") return `Shipment ${value}`;
  if (parent === "movements") return `Movement ${value}`;
  return value.replaceAll("-", " ");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
