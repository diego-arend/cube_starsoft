import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export interface ConversationSummary {
  id: string;
  sessionId: string;
  title: string;
  updatedAt: string;
  agentId?: string | null;
}

interface AssistantState {
  messages: Message[];
  isConnected: boolean;
  isTyping: boolean;
  conversationId: string | null;
  conversations: ConversationSummary[];
  inputValue: string;
  agentId: string | null;
  socket: Socket | null;
  authToken: string | null;

  connect: (token: string) => void;
  disconnect: () => void;
  setInputValue: (val: string) => void;
  setAgentId: (id: string | null) => void;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
  startNewConversation: () => void;
  fetchConversations: (agentId: string, token: string) => Promise<void>;
  loadConversation: (sessionId: string, token: string) => Promise<void>;
  deleteConversation: (id: string, token: string) => Promise<void>;
  clearSessionCache: (token: string) => Promise<void>;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  messages: [],
  isConnected: false,
  isTyping: false,
  conversationId: null,
  conversations: [],
  inputValue: "",
  agentId: null,
  socket: null,
  authToken: null,

  connect: (token: string) => {
    if (get().socket?.connected) return;

    set({ authToken: token });

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "";
    const finalSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
      ? socketUrl
      : socketUrl.replace(/\/api$/, "");

    const socket = io(`${finalSocketUrl}/assistant`, {
      auth: { token },
      // websocket-only: matches server config; avoids HTTP polling fan-out
      // across replicas before the WebSocket upgrade (no sticky sessions needed).
      transports: ["websocket"],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("[Assistant] Socket connected successfully");
      set({ isConnected: true, socket });
    });

    socket.on("connect_error", (error) => {
      console.error("[Assistant] Socket connection error:", error.message);
      set({ isConnected: false });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Assistant] Socket disconnected:", reason);
      set({ isConnected: false });
    });

    socket.on(
      "assistant:chunk",
      (data: { messageId: string; chunk: string }) => {
        const { messages } = get();
        const existingMessageIndex = messages.findIndex(
          (m) => m.id === data.messageId
        );

        if (existingMessageIndex > -1) {
          const updatedMessages = [...messages];
          updatedMessages[existingMessageIndex] = {
            ...updatedMessages[existingMessageIndex]!,
            content:
              updatedMessages[existingMessageIndex]!.content + data.chunk,
            isStreaming: true,
          };
          set({ messages: updatedMessages, isTyping: true });
        } else {
          set({
            messages: [
              ...messages,
              {
                id: data.messageId,
                role: "assistant",
                content: data.chunk,
                isStreaming: true,
              },
            ],
            isTyping: true,
          });
        }
      }
    );

    socket.on("assistant:done", (data: { messageId: string }) => {
      const { messages } = get();
      set({
        messages: messages.map((m) =>
          m.id === data.messageId ? { ...m, isStreaming: false } : m
        ),
        isTyping: false,
      });
      // Refresh conversation list so new conversations appear in history
      const { agentId, authToken, fetchConversations } = get();
      if (agentId && authToken) {
        fetchConversations(agentId, authToken);
      }
    });

    socket.on(
      "assistant:error",
      (data: { error: string; messageId?: string }) => {
        const { messages } = get();

        const alreadyHasPlaceholder = messages.some(
          (m) => m.id === data.messageId
        );

        const updatedMessages = alreadyHasPlaceholder
          ? messages.map((m) =>
              m.id === data.messageId
                ? { ...m, content: data.error, isStreaming: false }
                : { ...m, isStreaming: false }
            )
          : [
              ...messages.map((m) => ({ ...m, isStreaming: false })),
              {
                id: data.messageId || uuidv4(),
                role: "assistant" as const,
                content: data.error,
                isStreaming: false,
              },
            ];

        set({ messages: updatedMessages, isTyping: false });
      }
    );

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, isConnected: false });
  },

  setInputValue: (val: string) => set({ inputValue: val }),

  setAgentId: (id: string | null) =>
    set({ agentId: id, conversations: [], messages: [], conversationId: null }),

  sendMessage: (content: string) => {
    const { socket, conversationId, messages, agentId } = get();
    if (!socket) return;

    // If no active conversation, generate new UUID — backend uses it as sessionId
    const activeConversationId = conversationId ?? uuidv4();
    if (!conversationId) {
      set({ conversationId: activeConversationId });
    }

    const messageId = uuidv4();
    const userMessage: Message = { id: uuidv4(), role: "user", content };

    set({
      messages: [...messages, userMessage],
      isTyping: true,
    });

    socket.emit("assistant:query", {
      conversationId: activeConversationId,
      sessionId: activeConversationId,
      messageId,
      query: content,
      agentId,
    });
  },

  clearMessages: () => set({ messages: [], conversationId: null }),

  startNewConversation: () => set({ messages: [], conversationId: null }),

  fetchConversations: async (agentId: string, token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(
        `${apiUrl}/assistant/conversations?agentId=${agentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        set({ conversations: data });
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  },

  loadConversation: async (sessionId: string, token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}/assistant/history/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const history = await response.json();
        const formattedMessages: Message[] = history.map(
          (msg: {
            id: string;
            role: "user" | "assistant";
            content: string;
          }) => ({
            id: msg.id || uuidv4(),
            role: msg.role,
            content: msg.content,
          })
        );
        set({ messages: formattedMessages, conversationId: sessionId });
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  },

  deleteConversation: async (id: string, token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const { conversations, conversationId } = get();
      const convToDelete = conversations.find((c) => c.id === id);

      const response = await fetch(`${apiUrl}/assistant/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        set({ conversations: conversations.filter((c) => c.id !== id) });
        if (convToDelete && conversationId === convToDelete.sessionId) {
          set({ messages: [], conversationId: null });
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  },

  clearSessionCache: async (token: string) => {
    const { conversationId } = get();
    if (!conversationId) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      await fetch(`${apiUrl}/assistant/clear-cache/${conversationId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ messages: [], conversationId: null });
    } catch (error) {
      console.error("Error clearing assistant cache:", error);
    }
  },
}));
