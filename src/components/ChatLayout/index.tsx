'use client'
import Sidebar from '@/components/Sidebar'
import ChatArea from '@/components/ChatArea'
import styles from './index.module.scss'
import { memo } from 'react'

const ChatLayout = () => {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <ChatArea />
    </div>
  )
}

export default memo(ChatLayout);
