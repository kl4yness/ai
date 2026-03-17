export interface UserCreditData {
  age?: number;
  hasJob?: boolean;
  jobYears?: number;
  salary?: number;
  creditHistory?: 'excellent' | 'good' | 'fair' | 'poor' | 'none';
  property?: string[];
  hasOtherCredits?: boolean;
  creditPurpose?: string;
}

export interface CreditScoreResult {
  score: number;
  maxScore: number;
  percentage: number;
  approved: boolean;
  reasons: string[];
  minScoreForCredit: number;
  missingFields: string[];
}

// Расширяем тип Chat, добавив кредитные данные
declare module "@/types/Chat" {
  interface Chat {
    creditData?: UserCreditData;
    creditResult?: CreditScoreResult;
  }
}