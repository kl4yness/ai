import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Message } from "@/types/Message";
import type { Chat } from "@/types/Chat";

interface ChatStore {
  chats: Record<string, Chat>;
  addChat: (chat: Chat) => void;
  removeChat: (id: string) => void;
  addMessage: (chatId: string, message: Message) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
  chatTitle: string;
  setChatTitle: (chatId: string, newTitle: string) => void;
  isLoading: boolean;
  setIsLoading: (status: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      chats: {},
      activeChatId: null,
      chatTitle: "Новый чат",
      isLoading: false,

      addChat: (chat: Chat) =>
        set((state) => ({
          chats: { ...state.chats, [chat.id]: chat },
        })),

      removeChat: (id: string) =>
        set((state) => {
          const chatsCopy = { ...state.chats };
          delete chatsCopy[id];
          return { chats: chatsCopy };
        }),

      addMessage: (chatId: string, message: Message) =>
        set((state) => {
          const chatsCopy = { ...state.chats };
          const chat = chatsCopy[chatId];
          if (!chat) return state;
          chatsCopy[chatId] = {
            ...chat,
            messages: [...chat.messages, message],
          };
          return { chats: chatsCopy };
        }),

      setActiveChatId: (id: string) =>
        set(() => ({
          activeChatId: id,
        })),

      setChatTitle: (chatId: string, newTitle: string) =>
        set((state) => ({
          chats: {
            ...state.chats,
            [chatId]: {
              ...state.chats[chatId],
              title: newTitle,
            },
          },
        })),

      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "chat-store",
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => localStorage)
          : undefined,
    }
  )
);
