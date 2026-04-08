"use client";

import { useEffect } from "react";
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
  Button,
  Input,
  Label,
  Textarea,
  toast,
  Switch,
} from "@turborepo/ui";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api-fetch";
import { AgentDto } from "@turborepo/database/client";
import { Controller } from "react-hook-form";

interface EditAgentDialogProps {
  agent: AgentDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  isActive: z.boolean(),
});

export function EditAgentDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: EditAgentDialogProps) {
  const { data: session } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      specialty: "",
      description: "",
      guardRails: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (agent) {
      form.reset({
        name: agent.name,
        specialty: agent.specialty,
        description: agent.description || "",
        guardRails: agent.guardRails || "",
        isActive: agent.isActive ?? true,
      });
    }
  }, [agent, form]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!session?.accessToken || !agent) return;

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agents/${agent.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error("Falha ao atualizar agente");
      }

      toast.success("Agente atualizado com sucesso");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Erro ao atualizar agente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Agente de IA</DialogTitle>
          <DialogDescription>
            Atualize as configurações do agente especializado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nome do Agente</Label>
            <Input
              id="edit-name"
              placeholder="Ex: Financeiro, Marketing"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-specialty">Especialidade</Label>
            <Textarea
              id="edit-specialty"
              placeholder="Ex: Você é um especialista financeiro..."
              className="min-h-[100px]"
              {...form.register("specialty")}
            />
            {form.formState.errors.specialty && (
              <p className="text-sm text-destructive">
                {form.formState.errors.specialty.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
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
            <Label htmlFor="edit-guardRails">Guard Rails</Label>
            <Textarea
              id="edit-guardRails"
              placeholder="Ex: Nunca discuta preços de concorrentes..."
              className="min-h-[100px]"
              {...form.register("guardRails")}
            />
            {form.formState.errors.guardRails && (
              <p className="text-sm text-destructive">
                {form.formState.errors.guardRails.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Status do Agente</Label>
              <p className="text-[0.8rem] text-muted-foreground">
                Agentes desativados não aparecem para os usuários.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
