import Message from "@/components/Message";
import styles from "./index.module.scss";
import { useChatStore } from "@/store/chatStore";
import { memo } from "react";

const TypingDots = () => {
  return (
    <div className={styles.typingIndicator}>
      <span className={styles.dot}></span>
      <span className={styles.dot}></span>
      <span className={styles.dot}></span>
    </div>
  );
};

const MessageList = () => {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const chats = useChatStore((state) => state.chats);
  const isLoading = useChatStore((state) => state.isLoading);

  const messages = activeChatId ? chats[activeChatId]?.messages ?? [] : [];

  return (
    <div className={styles.messageList}>
      <div className={styles.messages}>
        {messages.map((message) => {
          const date = new Date(message.sendedAt).toLocaleString("ru-RU");
          return (
            <Message
              key={message.id}
              content={message.message}
              isUser={message.role === "user"}
              timestamp={date}
            />
          );
        })}

        {isLoading && <TypingDots />}
      </div>
    </div>
  );
};

export default memo(MessageList);
