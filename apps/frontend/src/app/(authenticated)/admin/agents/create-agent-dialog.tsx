"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Input,
  Label,
  Textarea,
  toast,
} from "@turborepo/ui";
import { Plus, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api-fetch";

interface CreateAgentDialogProps {
  onSuccess: () => void;
}

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  specialty: z.string().min(1, "Especialidade é obrigatória"),
  description: z
    .string()
    .max(500, "Descrição muito longa")
    .optional()
    .nullable(),
  guardRails: z.string().min(1, "Guard Rails são obrigatórios"),
});

export function CreateAgentDialog({ onSuccess }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      specialty: "",
      description: "",
      guardRails: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!session?.accessToken) return;

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error("Falha ao criar agente");
      }

      toast.success("Agente criado com sucesso");
      setOpen(false);
      form.reset();
      onSuccess();
    } catch {
      toast.error("Erro ao criar agente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Agente de IA</DialogTitle>
          <DialogDescription>
            Configure um novo agente especializado definindo seu papel e
            restrições.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do Agente</Label>
            <Input
              id="name"
              placeholder="Ex: Financeiro, Marketing"
              {...form.register("name")}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Defina o nome do Agente de acordo com o setor. Ex: Financeiro,
              Marketing, Departamento Pessoal, etc
            </p>
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="specialty">Especialidade</Label>
            <Textarea
              id="specialty"
              placeholder="Ex: Você é um especialista financeiro..."
              className="min-h-[100px]"
              {...form.register("specialty")}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Defina a personalidade especializada do Agente de acordo com sua
              funcionalidade. Ex: Você é um especialista financeiro.
            </p>
            {form.formState.errors.specialty && (
              <p className="text-sm text-destructive">
                {form.formState.errors.specialty.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Ex: Agente de RH especializado em contratação..."
              className="min-h-20"
              {...form.register("description")}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Breve descrição que aparecerá no card do agente.
            </p>
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="guardRails">Guard Rails</Label>
            <Textarea
              id="guardRails"
              placeholder="Ex: Nunca discuta preços de concorrentes..."
              className="min-h-[100px]"
              {...form.register("guardRails")}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Defina os GuardRails do agente.
            </p>
            {form.formState.errors.guardRails && (
              <p className="text-sm text-destructive">
                {form.formState.errors.guardRails.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar Agente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
