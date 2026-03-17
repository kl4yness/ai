"use client";

import { Send, Paperclip, Mic } from "lucide-react";
import styles from "./index.module.scss";
import { useChatStore } from "@/store/chatStore";
import { requestAI } from "@/service/requestAi";
import { nanoid } from "nanoid";
import { useState, memo } from "react";
import { generateTitle } from "@/service/generateTitle";
import TextareaAutosize from "react-textarea-autosize";

const MessageInput = () => {
  
  const activeChatId = useChatStore((state) => state.activeChatId);
  const addMessage = useChatStore((state) => state.addMessage);
  const isLoading = useChatStore((state) => state.isLoading);

  const [value, setValue] = useState("");

  const sendRequest = (userMessage: string) => {
    if (!activeChatId || value.length === 0) return;

    const userMessageObject = {
      id: nanoid(),
      role: "user" as const,
      message: userMessage,
      sendedAt: new Date().toISOString(),
    };

    const chatId = activeChatId;
    const store = useChatStore.getState();
    const chat = store.chats[chatId];
    const currentMessages = chat?.messages ?? [];

    addMessage(chatId, userMessageObject);
    requestAI([...currentMessages, userMessageObject], chatId);
    setValue("");

    const updatedChat = useChatStore.getState().chats[chatId];

    if (
      updatedChat.messages.length === 1 &&
      (updatedChat.title === "Новый чат" || updatedChat.title.trim() === "")
    ) {
      generateTitle([...currentMessages, userMessageObject], chatId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // отменяем переход на новую строку
      if (value.trim()) {
        sendRequest(value);
        setValue(""); // очищаем поле
      }
    }
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputContainer}>

        <div className={styles.inputWrapper}>
          <TextareaAutosize
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            minRows={1}
            maxRows={8}
            placeholder="Введите сообщение..."
            className={styles.input}
          />
        </div>

        <button
          className={styles.sendBtn}
          onClick={() => sendRequest(value)}
          disabled={isLoading}
        >
          <Send size={20} />
        </button>
      </div>

     
    </div>
  );
};

export default memo(MessageInput);
