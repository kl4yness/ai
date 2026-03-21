import { CreditScoreResult, UserCreditData } from "./CreditData";
import { Message } from "./Message";

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  creditData?: UserCreditData;
  creditResult?: CreditScoreResult;
  isCompleted?: boolean; // 👈 новое поле
}