import { CreditScoreResult, UserCreditData } from "./CreditData";
import { Message } from "./Message";

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  creditData?: UserCreditData; 
  creditResult?: CreditScoreResult; 
}
