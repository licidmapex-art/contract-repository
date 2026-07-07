"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/folders": "Folders",
  "/upload": "Upload",
  "/review": "Review",
  "/entities": "Parties",
  "/settings/api-keys": "API Keys",
  "/settings/naming": "Naming",
  "/settings/metadata": "Metadata Fields",
  "/settings/ingest": "Email Ingest",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/contracts/")) return "Contract Detail";
  return "Contract Repository";
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          icon={<LogOut className="h-4 w-4" />}
          onClick={handleLogout}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
