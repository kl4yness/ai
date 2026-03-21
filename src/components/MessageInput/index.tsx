"use client";

import { Send } from "lucide-react";
import styles from "./index.module.scss";
import { useChatStore } from "@/store/chatStore";
import { requestAI } from "@/service/requestAi";
import { nanoid } from "nanoid";
import { useState, memo } from "react";
import { generateTitle } from "@/service/generateTitle";
import type { Chat } from "@/types/Chat";

// Заготовки ответов в зависимости от этапа диалога
const answerTemplates = {
  initial: [
    { text: "Хочу оформить кредит", value: "Хочу оформить кредит" },
    { text: "Узнать условия кредитования", value: "Хочу узнать условия кредитования" },
    { text: "Рассчитать кредит", value: "Хочу рассчитать кредит" },
  ],
  age: [
    { text: "18 лет", value: "Мне 18 лет" },
    { text: "25 лет", value: "Мне 25 лет" },
    { text: "35 лет", value: "Мне 35 лет" },
    { text: "45 лет", value: "Мне 45 лет" },
  ],
  job: [
    { text: "Работаю, стаж 1 год", value: "Работаю, стаж 1 год" },
    { text: "Работаю, стаж 3 года", value: "Работаю, стаж 3 года" },
    { text: "Работаю, стаж 5+ лет", value: "Работаю, стаж 5 лет" },
    { text: "Не работаю", value: "Не работаю" },
  ],
  salary: [
    { text: "30 000 ₽", value: "30 тысяч рублей" },
    { text: "50 000 ₽", value: "50 тысяч рублей" },
    { text: "70 000 ₽", value: "70 тысяч рублей" },
    { text: "100 000+ ₽", value: "100 тысяч рублей" },
  ],
  creditHistory: [
    { text: "Кредитов не было", value: "Кредитов не было, истории нет" },
    { text: "Хорошая, платил вовремя", value: "Хорошая кредитная история, платил вовремя" },
    { text: "Были просрочки", value: "Были просрочки по кредитам" },
    { text: "Есть текущие кредиты", value: "Есть кредиты, плачу вовремя" },
  ],
  hasOtherCredits: [
    { text: "Нет других кредитов", value: "Нет других кредитов" },
    { text: "Есть кредит", value: "Есть кредит, плачу вовремя" },
  ],
};

// Определяем текущий этап на основе собранных данных
const getCurrentStep = (userData: any): keyof typeof answerTemplates => {
  // Возраст
  if (!userData.age) return "age";
  
  // Работа: если не указана — спрашиваем
  if (userData.hasJob === undefined) return "job";
  
  // Если нет работы — пропускаем salary, сразу переходим к кредитной истории
  if (userData.hasJob === false) {
    if (!userData.creditHistory) return "creditHistory";
    if (userData.hasOtherCredits === undefined) return "hasOtherCredits";
    return "initial";
  }
  
  // Если есть работа — проверяем доход
  if (userData.hasJob === true) {
    if (!userData.salary) return "salary";
    if (!userData.creditHistory) return "creditHistory";
    if (userData.hasOtherCredits === undefined) return "hasOtherCredits";
  }
  
  return "initial";
};

const MessageInput = () => {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const addMessage = useChatStore((state) => state.addMessage);
  const isLoading = useChatStore((state) => state.isLoading);
  const chats = useChatStore((state) => state.chats);
  const addChat = useChatStore((state) => state.addChat);
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // Получаем текущий чат и собранные данные
  const currentChat = activeChatId ? chats[activeChatId] : null;
  const userData = currentChat?.creditData || {};
  const isCompleted = currentChat?.isCompleted === true;

  const currentStep = getCurrentStep(userData);
  const templates = answerTemplates[currentStep] || answerTemplates.initial;

  // Показываем кнопки-заготовки, только если чат не завершён и не идёт загрузка
  const showTemplates = !isLoading && !isCompleted;

  const sendMessage = (message: string) => {
    if (!activeChatId || !message.trim() || isCompleted) return;

    const userMessageObject = {
      id: nanoid(),
      role: "user" as const,
      message: message.trim(),
      sendedAt: new Date().toISOString(),
    };

    const chatId = activeChatId;
    const store = useChatStore.getState();
    const chat = store.chats[chatId];
    const currentMessages = chat?.messages ?? [];

    addMessage(chatId, userMessageObject);
    requestAI([...currentMessages, userMessageObject], chatId);

    // Генерация заголовка для нового чата
    const updatedChat = useChatStore.getState().chats[chatId];
    if (
      updatedChat.messages.length === 1 &&
      (updatedChat.title === "Новый чат" || updatedChat.title.trim() === "")
    ) {
      generateTitle([...currentMessages, userMessageObject], chatId);
    }
  };

  const handleNewChat = () => {
    const newId = nanoid();
    const newChat: Chat = {
      id: newId,
      title: "Новый чат",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addChat(newChat);
    setActiveChatId(newId);
    setShowCustomInput(false);
    setCustomValue("");
  };

  const handleTemplateClick = (value: string) => {
    if (isLoading || isCompleted) return;
    sendMessage(value);
    setShowCustomInput(false);
    setCustomValue("");
  };

  const handleCustomSubmit = () => {
    if (customValue.trim() && !isLoading && !isCompleted) {
      sendMessage(customValue);
      setCustomValue("");
      setShowCustomInput(false);
    }
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputContainer}>
        
        {/* Сообщение о завершении чата с кнопкой новой заявки */}
        {isCompleted && (
          <div className={styles.completedWrapper}>
            <div className={styles.completedMessage}>
              <span>✅ Заявка рассмотрена</span>
            </div>
          </div>
        )}

        {/* Кнопки-заготовки (только если чат не завершён) */}
        {showTemplates && (
          <div className={styles.templatesWrapper}>
            <div className={styles.templatesGrid}>
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  className={styles.templateBtn}
                  onClick={() => handleTemplateClick(template.value)}
                  disabled={isLoading}
                >
                  {template.text}
                </button>
              ))}
            </div>
          </div>
        )}

       

      </div>
    </div>
  );
};

export default memo(MessageInput);