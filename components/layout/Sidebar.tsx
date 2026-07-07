"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  Mail,
  Tag,
  Upload,
  Users,
  ClipboardCheck,
  List,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const mainLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/folders", label: "Folders", icon: FolderOpen },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/entities", label: "Parties", icon: Users },
];

const settingsLinks = [
  { href: "/settings/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/settings/naming", label: "Naming", icon: Tag },
  { href: "/settings/metadata", label: "Fields", icon: List },
  { href: "/settings/ingest", label: "Email", icon: Mail },
];

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/entities") return pathname.startsWith("/entities");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  if (!mounted) {
    return <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar" />;
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-w-0"
          >
            <p className="truncate text-sm font-semibold text-foreground">
              Contract Repo
            </p>
            <p className="truncate text-[10px] text-muted">Intelligent pilot</p>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {mainLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-active text-sidebar-active-text"
                  : "text-muted hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}

        {!collapsed && (
          <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </p>
        )}
        {collapsed && <div className="my-2 border-t border-sidebar-border" />}

        {settingsLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-active text-sidebar-active-text"
                  : "text-muted hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-accent hover:text-accent-foreground"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
