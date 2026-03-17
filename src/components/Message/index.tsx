import { Bot, User } from 'lucide-react'
import styles from './index.module.scss'
import { memo } from 'react'

interface MessageProps {
  content: string
  isUser: boolean
  timestamp: string
}

const Message = ({ content, isUser, timestamp }: MessageProps) => {
  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.ai}`}>
      <div className={styles.avatar}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      
      <div className={styles.content}>
        <div className={styles.bubble}>
          <pre className={styles.text}>{content}</pre>
        </div>
        <div className={styles.timestamp}>{timestamp}</div>
      </div>
    </div>
  )
}

export default memo(Message);
