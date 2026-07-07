"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { href: "/settings/api-keys", label: "API Keys" },
  { href: "/settings/naming", label: "Naming" },
  { href: "/settings/metadata", label: "Fields" },
  { href: "/settings/ingest", label: "Email" },
];

export function SettingsRibbon() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card/60 p-1">
      {settingsTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
