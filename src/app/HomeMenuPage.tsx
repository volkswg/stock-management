"use client";

import {
  ArrowRightOutlined,
  AuditOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DollarOutlined,
  DownOutlined,
  FundOutlined,
  MenuOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TeamOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./page.module.css";

type MenuItem = {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
};

type MenuGroup = {
  id: string;
  title: string;
  description: string;
  tone: string;
  icon: ReactNode;
  items: MenuItem[];
};

function StockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5 M12 12v10" />
    </svg>
  );
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "stock-menu", title: "Stock", description: "Purchasing and inventory", tone: "green", icon: <StockIcon />,
    items: [
      { href: "/orders", icon: <ShoppingCartOutlined />, title: "Orders", description: "Manage purchase orders" },
      { href: "/shipments", icon: <TruckOutlined />, title: "Shipments", description: "Track incoming stock" },
      { href: "/movements", icon: <SwapOutlined />, title: "Movements", description: "Review stock changes" },
      { href: "/stock-counts", icon: <AuditOutlined />, title: "Monthly stock count", description: "Count stock, log gifts and other unit adjustments" },
    ],
  },
  {
    id: "sales-menu", title: "Sales", description: "Performance and reporting", tone: "blue", icon: <FundOutlined />,
    items: [
      { href: "/sales/daily-sales", icon: <CalendarOutlined />, title: "Daily sales", description: "Review sales by day" },
      { href: "/sales/dashboard", icon: <DashboardOutlined />, title: "Dashboard", description: "Explore sales performance" },
      { href: "/sales/profit-summary", icon: <FundOutlined />, title: "Profit summary", description: "Review profit reports" },
      { href: "/sales/sync-status", icon: <DatabaseOutlined />, title: "Sync status", description: "Check sales data imports" },
    ],
  },
  {
    id: "expenses-menu", title: "Expenses", description: "Shop and shared operating costs", tone: "amber", icon: <DollarOutlined />,
    items: [
      { href: "/expenses", icon: <DollarOutlined />, title: "Expense entries", description: "Manage individual shop and shared expenses" },
      { href: "/expenses/categories", icon: <AuditOutlined />, title: "Expense categories", description: "Manage expense categories" },
      { href: "/expenses/shops", icon: <ShopOutlined />, title: "Shop master", description: "Manage shops and optional Loyverse mappings" },
    ],
  },
  {
    id: "human-resources-menu", title: "Human resources", description: "People, attendance and pay", tone: "amber", icon: <TeamOutlined />,
    items: [
      { href: "/employees", icon: <TeamOutlined />, title: "Employees", description: "Manage your team" },
      { href: "/timesheets", icon: <ClockCircleOutlined />, title: "Timesheets", description: "Review attendance and leave" },
      { href: "/employees/advances", icon: <DollarOutlined />, title: "Salary advances", description: "Record advance payments and payroll deductions" },
      { href: "/employees/payroll", icon: <DollarOutlined />, title: "Payroll", description: "Calculate pay and export PDFs" },
    ],
  },
  {
    id: "loyverse-menu", title: "Loyverse", description: "Point-of-sale reports", tone: "purple", icon: <ShopOutlined />,
    items: [
      { href: "/loyverse/daily-sales", icon: <ShopOutlined />, title: "Loyverse daily sales", description: "View sales from Loyverse" },
    ],
  },
];

const SHORTCUTS = [
  { href: "/sales/daily-sales", title: "Daily sales", category: "Sales", tone: "blue", icon: <FundOutlined /> },
  { href: "/movements", title: "Stock movements", category: "Stock", tone: "green", icon: <StockIcon /> },
  { href: "/employees/payroll", title: "Payroll", category: "Human resources", tone: "amber", icon: <TeamOutlined /> },
];

export function HomeMenuPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const search = query.trim().toLocaleLowerCase();
  const groups = MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      `${group.title} ${group.description} ${item.title} ${item.description}`.toLocaleLowerCase().includes(search),
    ),
  })).filter((group) => group.items.length > 0);
  const resultCount = groups.reduce((total, group) => total + group.items.length, 0);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => {
      setCollapsed(media.matches ? ["human-resources-menu", "loyverse-menu"] : []);
      setMenuOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className={styles.appShell}>
      <a href="#workspace" className={styles.skipLink}>Skip to workspace</a>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand} aria-label="Stock Management home">
            <span className={styles.brandIcon}><StockIcon /></span>
            <span>Stock Management</span>
          </Link>
          <span className={styles.activeTab}>Workspace</span>
          <button ref={menuButton} className={styles.mobileMenuButton} type="button" aria-label={menuOpen ? "Close workspace menu" : "Open workspace menu"} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <CloseOutlined /> : <MenuOutlined />}
          </button>
        </div>
        {menuOpen && (
          <nav id="workspace-navigation" aria-label="Workspace sections" className={styles.mobileNav} onKeyDown={(event) => {
            if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
          }}>
            {MENU_GROUPS.map((group) => <a key={group.id} href={`#${group.id}`} onClick={() => { setCollapsed((current) => current.filter((id) => id !== group.id)); setQuery(""); setMenuOpen(false); }}>{group.title}<ArrowRightOutlined /></a>)}
          </nav>
        )}
      </header>

      <main id="workspace" className={styles.content}>
        <div className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Your workspace</span>
            <h1>Everything in one place.</h1>
            <p>Manage stock, sales and your team.</p>
          </div>
          <div className={styles.searchBox} role="search" aria-label="Workspace pages">
            <SearchOutlined aria-hidden="true" />
            <input type="search" aria-label="Find a page" placeholder="Find a page…" value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><CloseOutlined /></button>}
          </div>
        </div>

        <section className={styles.quickSection} aria-labelledby="quick-access">
          <h2 id="quick-access">Quick access</h2>
          <div className={styles.shortcuts}>
            {SHORTCUTS.map((item) => (
              <a href={item.href} className={styles.shortcut} key={item.href}>
                <span className={`${styles.tileIcon} ${styles[item.tone]}`} aria-hidden="true">{item.icon}</span>
                <span className={styles.shortcutText}><strong>{item.title}</strong><span>{item.category}</span></span>
                <ArrowRightOutlined className={styles.shortcutArrow} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <section className={styles.exploreSection} aria-labelledby="explore-workspace">
          <div className={styles.exploreHeading}>
            <h2 id="explore-workspace">Explore workspace</h2>
            <span role="status" aria-live="polite">{search ? `${resultCount} ${resultCount === 1 ? "page" : "pages"} found` : ""}</span>
          </div>
          <div className={styles.groupGrid}>
            {groups.map((group) => {
              const expanded = Boolean(search) || !collapsed.includes(group.id);
              return (
                <section key={group.id} className={styles.groupCard} aria-labelledby={group.id}>
                  <h3 id={group.id}>
                    <button className={styles.groupHeader} type="button" aria-expanded={expanded} aria-controls={`${group.id}-pages`} onClick={() => {
                      if (search) return;
                      setCollapsed((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id]);
                    }} aria-disabled={Boolean(search)}>
                      <span className={`${styles.tileIcon} ${styles[group.tone]}`} aria-hidden="true">{group.icon}</span>
                      <span className={styles.groupHeadingText}><strong>{group.title}</strong><span>{group.description}</span></span>
                      {!expanded && <span className={styles.pageCount}>{group.items.length} {group.items.length === 1 ? "page" : "pages"}</span>}
                      <DownOutlined className={`${styles.chevron} ${expanded ? styles.expanded : ""}`} aria-hidden="true" />
                    </button>
                  </h3>
                  <div id={`${group.id}-pages`} hidden={!expanded}>
                    <ul className={styles.groupItems}>
                      {group.items.map((item) => <li key={item.href}>
                        <a href={item.href} className={styles.pageLink}>
                          <span className={styles.rowIcon} aria-hidden="true">{item.icon}</span>
                          <span className={styles.rowText}><strong>{item.title}</strong><span>{item.description}</span></span>
                          <ArrowRightOutlined className={styles.rowArrow} aria-hidden="true" />
                        </a>
                      </li>)}
                    </ul>
                  </div>
                </section>
              );
            })}
          </div>
          {groups.length === 0 && <div className={styles.emptyState}><SearchOutlined aria-hidden="true" /><h3>No pages found</h3><p>Try a page name like “payroll”, “orders” or “sales”.</p><button type="button" onClick={() => setQuery("")}>Show all pages</button></div>}
        </section>
        <footer className={styles.footer}>Stock Management <span>·</span> Workspace</footer>
      </main>
    </div>
  );
}
