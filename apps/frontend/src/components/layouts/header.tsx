"use client";

import { ThemeToggle } from "../theme-toggle";
import { UserNav } from "./user-nav";
import { MobileSidebar } from "./sidebar";

export function Header() {
  return (
    <header className="border-b border-border bg-background text-foreground">
      <div className="flex h-16 items-center px-4">
        <MobileSidebar />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
