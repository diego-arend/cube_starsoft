import { Button } from "@turborepo/ui";
import Link from "next/link";
import { ThemeToggle } from "../theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">
            ET
          </div>
          <span className="text-xl tracking-tight">ENGECOMP-IA</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Recursos
          </Link>
          <Link
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Preços
          </Link>
          <Link
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Sobre
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Entrar
          </Link>
          <Link href="/cadastro">
            <Button variant="default">Começar</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
