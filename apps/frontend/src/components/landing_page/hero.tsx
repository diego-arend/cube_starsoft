import { Button, Badge } from "@turborepo/ui";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="w-full py-20 md:py-32 lg:py-40 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center space-y-8 text-center">
          <Badge
            variant="secondary"
            className="px-4 py-1 text-sm font-normal bg-muted/50 text-muted-foreground border-border/50"
          >
            Nova Versão 2.0 disponível!
          </Badge>

          <div className="space-y-4 max-w-4xl">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
              Gerencie seu negócio com <br className="hidden sm:inline" />
              <span className="text-primary">inteligência</span>
            </h1>
            <p className="mx-auto max-w-[800px] text-muted-foreground text-lg md:text-xl leading-relaxed">
              ENGECOMP-IA unifica todos os seus processos de negócios. Do
              estoque à análise, gerencie tudo em uma plataforma segura e
              baseada na nuvem.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/cadastro">
              <Button className="px-8 py-4 flex items-center gap-2 font-medium bg-primary hover:bg-primary/90 border border-primary whitespace-nowrap">
                Teste Grátis
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="px-8 py-4 font-medium bg-transparent border border-input hover:bg-muted/50 whitespace-nowrap"
            >
              Agendar Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
