import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@turborepo/ui";
import { Check, ArrowRight } from "lucide-react";

export function Pricing() {
  return (
    <section className="w-full py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
            Planos e Preços
          </h2>
          <p className="text-muted-foreground text-lg">
            Escolha o plano ideal para o seu negócio
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-12 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Basic Plan */}
          <Card className="flex flex-col items-center text-center border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-colors duration-300">
            <CardHeader className="p-8 pb-8 items-center">
              <CardTitle className="text-xl font-medium text-foreground">
                Plano Básico
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Para pequenas empresas
              </CardDescription>
              <div className="mt-4 flex items-baseline text-foreground">
                <span className="text-5xl font-bold tracking-tight">
                  R$ 100
                </span>
                <span className="ml-1 text-xl font-medium text-muted-foreground">
                  /mês
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Faturado R$ 1.200 anualmente
              </p>
            </CardHeader>
            <CardContent className="flex-1 w-full p-8 pt-0">
              <ul className="space-y-4 text-sm text-left inline-block">
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Gestão Financeira
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Controle de Estoque
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Suporte por Email
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Até 5 usuários
                </li>
              </ul>
            </CardContent>
            <CardFooter className="p-8 pt-8 w-full justify-center">
              <Button className="px-8 py-4 flex items-center gap-2 font-medium bg-primary hover:bg-primary/90 text-primary-foreground group border border-primary whitespace-nowrap">
                Assinar Básico
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 shrink-0" />
              </Button>
            </CardFooter>
          </Card>

          {/* Advanced Plan */}
          <Card className="flex flex-col items-center text-center border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-colors duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
              POPULAR
            </div>
            <CardHeader className="p-8 pb-8 items-center">
              <CardTitle className="text-xl font-medium text-foreground">
                Plano Avançado
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Para empresas em crescimento
              </CardDescription>
              <div className="mt-4 flex items-baseline text-foreground">
                <span className="text-5xl font-bold tracking-tight">
                  R$ 200
                </span>
                <span className="ml-1 text-xl font-medium text-muted-foreground">
                  /mês
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Faturado R$ 2.400 anualmente
              </p>
            </CardHeader>
            <CardContent className="flex-1 w-full p-8 pt-0">
              <ul className="space-y-4 text-sm text-left inline-block">
                <li className="flex items-center text-foreground font-medium">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Tudo do Plano Básico
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Gestão de RH
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Relatórios Avançados
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Suporte Prioritário 24/7
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="mr-3 h-5 w-5 text-primary" />
                  Usuários Ilimitados
                </li>
              </ul>
            </CardContent>
            <CardFooter className="p-8 pt-8 w-full justify-center">
              <Button className="px-8 py-4 flex items-center gap-2 font-medium bg-primary hover:bg-primary/90 text-primary-foreground group border border-primary whitespace-nowrap">
                Assinar Avançado
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
