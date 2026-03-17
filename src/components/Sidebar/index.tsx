"use client";

import { Plus, MessageSquare, Settings, User } from "lucide-react";
import styles from "./index.module.scss";
import { useChatStore } from "@/store/chatStore";
import type { Chat } from "@/types/Chat";
import { useMemo, memo } from "react";
import { nanoid } from "nanoid";

const Sidebar = () => {

  const chats = useChatStore(state => state.chats)
  const addChat = useChatStore(state => state.addChat)
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const chatList = useMemo(() => Object.values(chats), [chats]);
  const activeChatId = useChatStore(state => state.activeChatId)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <button
          className={styles.newChatBtn}
          onClick={() =>
            addChat({
              id: nanoid(),
              title: "Новый чат",
              createdAt: new Date().toISOString(),
              messages: [],
            })
          }
        >
          <Plus size={20} />
          <span>Новый чат</span>
        </button>
      </div>

      <div className={styles.chatList}>
        <h3 className={styles.sectionTitle}>История чатов</h3>
        {chatList.map((chat: Chat) => (
          <div
            key={chat.id}
            className={`${styles.chatItem} ${activeChatId === chat.id ? styles.active : ''}`}
            onClick={() => setActiveChatId(chat.id)}
          >
            <MessageSquare size={16} className={styles.chatIcon} />
            <div className={styles.chatContent}>
              <div className={styles.chatTitle}>{chat.title}</div>
              <div className={styles.chatTime}>
                {new Date(chat.createdAt).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default memo(Sidebar);
