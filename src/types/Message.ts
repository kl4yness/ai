export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  sendedAt: string;
  reasoning_details?: any;
}