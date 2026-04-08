"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAssistantStore } from "@/stores/assistant.store";
import { useSession } from "next-auth/react";
import {
  Bot,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeft,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  cn,
} from "@turborepo/ui";
import { apiFetch } from "@/lib/api-fetch";
import { AgentDto } from "@turborepo/database/client";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AssistantClient() {
  const { data: session } = useSession();
  const {
    agentId,
    setAgentId,
    startNewConversation,
    conversations,
    conversationId,
    messages,
    fetchConversations,
    loadConversation,
    deleteConversation,
  } = useAssistantStore();
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchAgents = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agents?limit=100&onlyActive=true`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setAgents(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch agents", error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleSelectAgent = (id: string) => {
    setAgentId(id);
    startNewConversation();
  };

  // Load history whenever agent is selected or session becomes available
  useEffect(() => {
    if (agentId && session?.accessToken) {
      fetchConversations(agentId, session.accessToken as string);
    }
  }, [agentId, session?.accessToken, fetchConversations]);

  const handleLoadConversation = (sessionId: string) => {
    if (session?.accessToken) {
      loadConversation(sessionId, session.accessToken as string);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!session?.accessToken) return;
    if (confirm("Deseja apagar esta conversa?")) {
      await deleteConversation(id, session.accessToken as string);
    }
  };

  const handleBackToAgents = async () => {
    // If the user had interactions with the assistant, refresh the history
    // before navigating back so the conversation is reflected next visit.
    const hadInteractions = messages.length > 0 && conversationId !== null;
    if (hadInteractions && agentId && session?.accessToken) {
      await fetchConversations(agentId, session.accessToken as string);
    }
    setAgentId(null);
  };

  const selectedAgent = agents.find((a) => a.id === agentId);

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 p-4 py-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Assistentes de IA
          </h1>
          <p className="text-muted-foreground text-lg">
            Escolha um especialista para começar sua jornada.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full justify-center">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="animate-pulse h-[200px] bg-muted/50 w-full max-w-sm"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 w-full">
            {agents
              .filter((agent) => agent.isActive)
              .map((agent) => (
                <Card
                  key={agent.id}
                  className="group hover:shadow-md transition-all cursor-pointer border-2 hover:border-primary/50 relative overflow-hidden w-full sm:w-72 md:w-80 h-[220px] flex flex-col shrink-0"
                  onClick={() => handleSelectAgent(agent.id)}
                >
                  <CardHeader className="flex-1 pb-2">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <CardTitle className="group-hover:text-primary transition-colors text-xl leading-tight">
                        {agent.name}
                      </CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                        <Bot size={20} />
                      </div>
                    </div>
                    <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                      {agent.description ||
                        agent.specialty ||
                        "Agente especializado pronto para ajudar."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-6 shrink-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Sparkles size={16} />
                      <span>Iniciar conversa</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {agents.filter((agent) => agent.isActive).length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl">
                <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  Nenhum agente encontrado
                </h3>
                <p className="text-muted-foreground">
                  Você ainda não criou nenhum agente de IA. Vá em Configurações
                  &gt; Agentes para começar.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* History sidebar — left */}
      <div
        className={cn(
          "flex flex-col border-r bg-muted/20 overflow-hidden transition-all duration-200",
          sidebarOpen ? "w-64 md:w-72" : "w-0"
        )}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b bg-background/70 shrink-0">
          <span className="text-sm font-semibold flex items-center gap-2 whitespace-nowrap">
            <MessageSquare size={15} />
            Histórico
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Nova conversa"
            onClick={startNewConversation}
          >
            <Plus size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-3">
              Nenhuma conversa ainda. Envie uma mensagem para começar.
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleLoadConversation(conv.sessionId)}
                className={cn(
                  "group flex items-start justify-between gap-1 px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors text-sm border-b border-border/40",
                  conversationId === conv.sessionId &&
                    "bg-primary/10 hover:bg-primary/15"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium leading-snug">
                    {conv.title || "Nova conversa"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(conv.updatedAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Apagar conversa"
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/50 backdrop-blur sticky top-0 z-10 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 hover:bg-primary/10"
            title={sidebarOpen ? "Fechar histórico" : "Abrir histórico"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <PanelLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 hover:bg-primary/10"
            onClick={handleBackToAgents}
            title="Voltar aos agentes"
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold truncate">{selectedAgent?.name}</h3>
            {(selectedAgent?.description || selectedAgent?.specialty) && (
              <p className="text-xs text-muted-foreground truncate italic hidden sm:block">
                {selectedAgent.description || selectedAgent.specialty}
              </p>
            )}
          </div>
        </div>
        <AssistantChat className="flex-1 border-none shadow-none rounded-none" />
      </div>
    </div>
  );
}
