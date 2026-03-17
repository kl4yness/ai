"use client";
import ChatHeader from "@/components/ChatHeader";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import styles from "./index.module.scss";
import { useChatStore } from "@/store/chatStore";
import { memo } from "react";

const ChatArea = () => {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const chats = useChatStore(state => state.chats)

  if(!activeChatId || Object.keys(chats).length < 1) return null;  
  return (
    <main className={styles.chatArea}>
      {activeChatId && (
        <>
          <ChatHeader />
          <MessageList />
          <MessageInput />
        </>
      )}
    </main>
  );
};

export default memo(ChatArea);
