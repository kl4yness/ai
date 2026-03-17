import { Bot, Trash } from "lucide-react";
import styles from "./index.module.scss";
import { useChatStore } from "@/store/chatStore";

const ChatHeader = () => {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const removeChat = useChatStore((state) => state.removeChat);

  return (
    <header className={styles.header}>
      <div className={styles.info}>
        <div className={styles.avatar}>
          <Bot size={20} />
        </div>
        <div className={styles.details}>
          <h2 className={styles.title}>AI Ассистент</h2>
          <p className={styles.status}>Онлайн</p>
        </div>
      </div>

      <button
        className={styles.menuBtn}
        onClick={() => {
          if (activeChatId) {
            removeChat(activeChatId);
          }
        }}
      >
        <Trash size={20} />
      </button>
    </header>
  );
};

export default ChatHeader;
