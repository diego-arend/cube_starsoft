"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAssistantStore } from "@/stores/assistant.store";
import { useSession } from "next-auth/react";
import {
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Brain,
  RotateCcw,
} from "lucide-react";
import { Button, Card, CardContent, CardFooter, cn } from "@turborepo/ui";
import { apiFetch } from "@/lib/api-fetch";
import { AgentDto } from "@turborepo/database";

const MessageContent = ({
  content,
  role,
}: {
  content: string;
  role: string;
}) => {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  if (role !== "assistant") {
    return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  const thinking = thinkMatch?.[1] ? thinkMatch[1].trim() : null;
  let response = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, "").trim();

  // Filter out internal markers like __AUDIO_URL__ to avoid displaying them
  if (response.startsWith("__AUDIO_URL__: ")) {
    response = "";
  }

  return (
    <div className="space-y-4">
      {thinking && (
        <div className="border-l-2 border-primary/20 pl-4 py-1 my-2 bg-muted/30 rounded-r-lg">
          <button
            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors mb-1 uppercase tracking-wider"
          >
            <Brain className="w-3 h-3" />
            {isThinkingExpanded ? "Ocultar Pensamento" : "Ver Pensamento"}
            {isThinkingExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {isThinkingExpanded && (
            <p className="text-sm text-muted-foreground italic leading-relaxed whitespace-pre-wrap opacity-80">
              {thinking}
            </p>
          )}
        </div>
      )}
      {response && (
        <p className="leading-relaxed whitespace-pre-wrap">{response}</p>
      )}
      {!response && thinking && !content.includes("</think>") && (
        <div className="flex gap-1 mt-2">
          <span className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce"></span>
        </div>
      )}
    </div>
  );
};

interface AssistantChatProps {
  className?: string;
}

export function AssistantChat({ className }: AssistantChatProps) {
  const { data: session } = useSession();
  const {
    messages,
    isConnected,
    isTyping,
    inputValue,
    agentId,
    connect,
    sendMessage,
    setInputValue,
    clearSessionCache,
  } = useAssistantStore();

  const [agents, setAgents] = useState<AgentDto[]>([]);

  const fetchAgents = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agents?limit=100`,
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
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.accessToken && !isConnected) {
      connect(session.accessToken as string);
    }
  }, [session, isConnected, connect]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue("");
    }
  };

  return (
    <Card
      className={cn(
        "flex-1 flex flex-col shadow-sm overflow-hidden border-none",
        className
      )}
    >
      <CardContent
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-primary/10"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
            <div className="p-4 bg-muted rounded-full">
              <Bot className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                Olá, {session?.user?.name?.split(" ")[0]}!
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Eu sou seu assistente inteligente. Como posso ajudar com seus
                processos hoje? Selecione um agente especializado acima para
                começar.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-1.5 w-full",
              m.role === "user" ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2 px-1",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                  m.role === "user" ? "bg-primary" : "bg-muted shadow-sm"
                )}
              >
                {m.role === "user" ? (
                  <User className="w-3.5 h-3.5 text-primary-foreground" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {m.role === "user"
                  ? "Você"
                  : agents.find((a) => a.id === agentId)?.name || "Suporte AI"}
              </span>
            </div>
            <div
              className={cn(
                "rounded-2xl p-4 shadow-sm w-full",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-card border rounded-tl-none"
              )}
            >
              <div className="flex flex-col gap-2">
                <MessageContent content={m.content} role={m.role} />
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col gap-1.5 w-full items-start">
            <div className="flex items-center gap-2 px-1">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {agents.find((a) => a.id === agentId)?.name || "Suporte AI"}
              </span>
            </div>
            <div className="bg-card border rounded-2xl rounded-tl-none p-4 shadow-sm w-full">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 border-t bg-muted/10">
        <div className="flex flex-col w-full gap-3">
          <form
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex w-full gap-2 relative items-center"
          >
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (
                    confirm(
                      "Deseja limpar o histórico desta conversa? Isso reiniciará o contexto do assistente."
                    )
                  ) {
                    clearSessionCache(session?.accessToken as string);
                  }
                }}
                disabled={!isConnected || messages.length === 0}
                className="shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors h-9 w-9"
                title="Limpar Histórico"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 relative">
              <input
                placeholder={isConnected ? "Escreva aqui..." : "Conectando..."}
                value={inputValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInputValue(e.target.value)
                }
                className="flex w-full rounded-xl border border-primary/20 bg-background px-3 py-5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10 shadow-inner"
                disabled={!isConnected}
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  !isConnected || (!inputValue.trim() && !isTyping) || isTyping
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg h-7 w-7"
              >
                {isTyping ? (
                  <span className="w-3.5 h-3.5 border-2 border-t-transparent border-primary-foreground rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </form>
          <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest font-medium opacity-50">
            Powered by DFA TECH
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
