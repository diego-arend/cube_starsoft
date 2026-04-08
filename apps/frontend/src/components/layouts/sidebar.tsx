"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@turborepo/ui";
import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@turborepo/ui";
import { useSession } from "next-auth/react";
import { Menu, Users, Bot, Database, Box } from "lucide-react";
import { useState } from "react";

const sidebarItems = [
  {
    title: "Assistentes de IA",
    href: "/assistant",
    icon: Bot,
    roles: ["USER", "ADMIN"],
  },
  {
    title: "Cube",
    href: "/cube",
    icon: Box,
    roles: ["USER", "ADMIN"],
  },
  {
    title: "KBase",
    href: "/embeddings",
    icon: Database,
    roles: ["ADMIN"],
  },
  {
    title: "Agentes de IA",
    href: "/admin/agents",
    icon: Bot,
    roles: ["ADMIN"],
  },
  {
    title: "Gestão de usuários",
    href: "/admin/users",
    icon: Users,
    roles: ["ADMIN"],
  },
];

interface SidebarContentProps {
  onItemClick?: () => void;
}

function SidebarContent({ onItemClick }: SidebarContentProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const filteredItems = sidebarItems.filter((item) =>
    userRole ? item.roles.includes(userRole) : false
  );

  return (
    <div className="space-y-4 py-4 h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-2">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-xl">
            ET
          </div>
          <span className="text-xl font-bold text-primary">CUBE STARSOFT</span>
        </div>
        <div className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "w-full justify-start h-12 text-base font-medium mb-1",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                asChild
                onClick={onItemClick}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 w-full"
                >
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    <item.icon
                      className={cn(
                        "h-5 w-5",
                        isActive && "text-sidebar-primary"
                      )}
                    />
                  </div>
                  <span className="truncate">{item.title}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="pb-12 w-64 border-r min-h-screen hidden md:block bg-sidebar">
      <SidebarContent />
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden mr-2"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>
      <SheetContent
        side="left"
        className="p-0 w-72 border-r border-border bg-sidebar"
      >
        <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
        <SheetDescription className="sr-only">
          Menu principal para navegação entre as seções do sistema.
        </SheetDescription>
        <SidebarContent onItemClick={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
