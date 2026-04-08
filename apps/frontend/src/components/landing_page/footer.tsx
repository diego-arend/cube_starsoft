import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full py-8 bg-background">
      <div className="container mx-auto px-4 md:px-6 flex flex-col items-center gap-6 md:flex-row md:justify-between">
        <div className="flex flex-col items-center md:items-start gap-2">
          <p className="text-lg font-bold tracking-tight">ENGECOMP-IA</p>
          <p className="text-sm text-muted-foreground">
            Rua da Tecnologia, 123 - Vale do Silício, SP
          </p>
          <p className="text-sm text-muted-foreground">
            contato@erp-tech.com.br | (11) 99999-9999
          </p>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <Link
            href="/termos"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors"
          >
            Termos de Uso
          </Link>
          <p className="text-xs text-muted-foreground/50">01/01/2025</p>
        </div>
      </div>
    </footer>
  );
}
