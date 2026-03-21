import type { UserCreditData, CreditScoreResult } from "@/types/CreditData";

export class CreditScoring {
  private static instance: CreditScoring;
  private minScoreForCredit = 70;
  private maxScore = 100;

  static getInstance() {
    if (!CreditScoring.instance) {
      CreditScoring.instance = new CreditScoring();
    }
    return CreditScoring.instance;
  }

  getRequiredFields(): string[] {
    return ['age', 'hasJob', 'creditHistory'];
  }

  hasAllData(data: UserCreditData): boolean {
    if (data.hasJob === false) {
      return data.age !== undefined && 
             data.hasJob !== undefined && 
             data.creditHistory !== undefined;
    }
    return this.getRequiredFields().every(field => data[field as keyof UserCreditData] !== undefined);
  }

  getMissingFields(data: UserCreditData): string[] {
    const required = this.getRequiredFields();
    
    if (data.hasJob === false) {
      return required.filter(field => data[field as keyof UserCreditData] === undefined);
    }
    
    return required.filter(field => data[field as keyof UserCreditData] === undefined);
  }

  calculateScore(data: UserCreditData): CreditScoreResult {
    let score = 0;
    const reasons: string[] = [];

    // Возраст (макс 15)
    if (data.age) {
      if (data.age >= 25 && data.age <= 45) score += 15;
      else if (data.age >= 46 && data.age <= 60) score += 10;
      else if (data.age >= 18 && data.age <= 24) {
        score += 5;
        reasons.push('Молодой возраст — повышенный риск');
      } else if (data.age > 60) {
        score += 5;
        reasons.push('Пенсионный возраст — нужен дополнительный анализ');
      }
    }

    // Работа и стаж (макс 25)
    if (data.hasJob) {
      if (data.jobYears && data.jobYears >= 5) score += 25;
      else if (data.jobYears && data.jobYears >= 2) score += 20;
      else if (data.jobYears && data.jobYears >= 1) score += 15;
      else {
        score += 10;
        reasons.push('Маленький стаж на текущем месте');
      }
    } else {
      reasons.push('Отсутствие постоянной работы');
    }

    // Зарплата (макс 30) — если нет работы, доход 0
    const salary = data.hasJob === false ? 0 : data.salary;
    if (salary !== undefined && salary !== null) {
      if (salary >= 100000) score += 30;
      else if (salary >= 70000) score += 25;
      else if (salary >= 50000) score += 20;
      else if (salary >= 30000) {
        score += 15;
        reasons.push('Невысокий уровень дохода');
      } else if (salary > 0 && salary < 30000) {
        score += 5;
        reasons.push('Доход ниже рекомендуемого');
      } else if (salary === 0) {
        reasons.push('Отсутствие дохода');
      }
    } else {
      reasons.push('Доход не указан');
    }

    // Кредитная история (макс 20)
    if (data.creditHistory) {
      switch (data.creditHistory) {
        case 'excellent': score += 20; break;
        case 'good': score += 15; break;
        case 'fair': 
          score += 10; 
          reasons.push('Средняя кредитная история');
          break;
        case 'poor': 
          reasons.push('Плохая кредитная история');
          break;
        case 'none': 
          score += 5; 
          reasons.push('Отсутствие кредитной истории');
          break;
      }
    }

    // Имущество (макс 10)
    if (data.property && data.property.length > 0) {
      score += Math.min(data.property.length * 5, 10);
    }

    // Другие кредиты (штраф)
    if (data.hasOtherCredits) {
      score -= 5;
      reasons.push('Наличие других кредитов');
    }

    return {
      score: Math.max(0, score),
      maxScore: this.maxScore,
      percentage: Math.min(100, Math.max(0, Math.round((score / this.maxScore) * 100))),
      approved: score >= this.minScoreForCredit,
      reasons,
      minScoreForCredit: this.minScoreForCredit,
      missingFields: this.getMissingFields(data)
    };
  }

  extractDataFromMessage(message: string, currentData: UserCreditData): UserCreditData {
    const newData = { ...currentData };
    const lowerMessage = message.toLowerCase();

    console.log("🔍 Парсим сообщение:", message);

    // Возраст
    const ageMatch = message.match(/(\d+)\s*(?:лет|год|года)/i);
    if (ageMatch && !lowerMessage.includes('стаж')) {
      const age = parseInt(ageMatch[1]);
      if (age >= 16 && age <= 100) {
        newData.age = age;
        console.log(`✅ Распознан возраст: ${age}`);
      }
    }

    // Зарплата
    const salaryMatch = message.match(/(\d+)\s*(?:тыс|тысяч|руб|р\.|рублей)/i);
    if (salaryMatch) {
      let salary = parseInt(salaryMatch[1]);
      if (message.includes('тыс') || message.includes('тысяч')) salary *= 1000;
      newData.salary = salary;
      console.log(`✅ Распознана зарплата: ${salary}`);
    }

    // Работа
    if (lowerMessage.includes('не работаю') || 
        lowerMessage.includes('безработный') ||
        lowerMessage.includes('нет работы')) {
      newData.hasJob = false;
      newData.salary = 0;
      console.log(`✅ Распознана работа: false, доход = 0`);
    }
    else if (lowerMessage.includes('работаю') || 
             lowerMessage.includes('трудоустроен') || 
             lowerMessage.includes('официально') ||
             lowerMessage.includes('есть работа') ||
             lowerMessage.includes('дворник') ||
             lowerMessage.includes('охранник') ||
             lowerMessage.includes('менеджер') ||
             lowerMessage.includes('водитель') ||
             lowerMessage.includes('продавец')) {
      newData.hasJob = true;
      console.log(`✅ Распознана работа: true`);
      
      const yearsMatch = message.match(/(\d+)\s*(?:год|года|лет)/i);
      if (yearsMatch) {
        newData.jobYears = parseInt(yearsMatch[1]);
        console.log(`✅ Распознан стаж: ${newData.jobYears} лет`);
      }
    }

    // Кредитная история
    if (lowerMessage.includes('идеальная') || lowerMessage.includes('отличная')) {
      newData.creditHistory = 'excellent';
      console.log(`✅ Кредитная история: excellent`);
    }
    else if (lowerMessage.includes('хорошая') || lowerMessage.includes('плачу вовремя')) {
      newData.creditHistory = 'good';
      console.log(`✅ Кредитная история: good`);
    }
    else if (lowerMessage.includes('средняя') || lowerMessage.includes('нормальная')) {
      newData.creditHistory = 'fair';
      console.log(`✅ Кредитная история: fair`);
    }
    else if (lowerMessage.includes('плохая') || lowerMessage.includes('испорчена') ||
             lowerMessage.includes('просрочк') || lowerMessage.includes('долг')) {
      newData.creditHistory = 'poor';
      console.log(`✅ Кредитная история: poor`);
    }
    else if (lowerMessage.includes('нет истории') || 
             lowerMessage.includes('не было кредитов') ||
             lowerMessage.includes('кредитной истории нет') ||
             lowerMessage.includes('кредитов не было') ||
             lowerMessage === 'нет' ||
             lowerMessage === 'нету') {
      newData.creditHistory = 'none';
      console.log(`✅ Кредитная история: none`);
    }

    // Другие кредиты
    if (lowerMessage.includes('есть кредит') || 
        lowerMessage.includes('плачу кредит') ||
        lowerMessage.includes('два кредита')) {
      newData.hasOtherCredits = true;
      console.log(`✅ Есть другие кредиты: true`);
    }
    else if (lowerMessage.includes('нет других кредитов') || 
             lowerMessage.includes('нет кредитов') ||
             lowerMessage.includes('кредитов нет') ||
             lowerMessage === 'нет') {
      newData.hasOtherCredits = false;
      console.log(`✅ Есть другие кредиты: false`);
    }

    console.log("📝 Итоговые данные:", {
      age: newData.age,
      hasJob: newData.hasJob,
      jobYears: newData.jobYears,
      salary: newData.hasJob === false ? 0 : newData.salary,
      creditHistory: newData.creditHistory,
      hasOtherCredits: newData.hasOtherCredits
    });

    return newData;
  }

  getSystemPrompt(userData?: UserCreditData, chatTitle?: string): string {
    const missingFields = userData ? this.getMissingFields(userData) : this.getRequiredFields();
    const noJob = userData?.hasJob === false;
    
    let nextQuestion = "";
    
    if (missingFields.includes('age')) {
      nextQuestion = "Спроси возраст.";
    } else if (missingFields.includes('hasJob')) {
      nextQuestion = "Спроси про наличие работы и стаж.";
    } else if (!noJob && missingFields.includes('salary')) {
      nextQuestion = "Спроси про ежемесячный доход.";
    } else if (missingFields.includes('creditHistory')) {
      nextQuestion = "Спроси про кредитную историю.";
    } else {
      nextQuestion = "Все данные собраны, скажи: Спасибо! Сейчас я рассчитаю предварительное решение.";
    }
    
    let prompt = `Ты — кредитный консультант. Собери данные строго по порядку.

🚨 ПРАВИЛА:
• Задавай ТОЛЬКО ОДИН вопрос за раз
• Не повторяй вопросы
• Будь краток — максимум одно предложение

Текущий этап: ${nextQuestion}

${noJob ? "⚠️ ВАЖНО: Пользователь не работает. НЕ спрашивай про работу и доход. Сразу переходи к кредитной истории." : ""}

Сейчас задай один короткий вопрос.`;

    return prompt;
  }

  generateFinalResponse(result: CreditScoreResult): string {
    if (result.approved) {
      return `✅ **Предварительное решение: кредит может быть одобрен!**

Ваш результат: ${result.percentage}% соответствия нашим требованиям.

${result.reasons.length > 0 ? '⚠️ Факторы, которые мы учли:\n' + result.reasons.map(r => `• ${r}`).join('\n') + '\n\n' : ''}
📋 **Что дальше?**
Для окончательного решения приглашаем вас в отделение банка с:
• Паспортом
• Справкой о доходах (2-НДФЛ)
• Трудовой книжкой

Хотите, чтобы мы записали вас на консультацию к специалисту?`;
    } else {
      return `❌ **Предварительное решение: кредит не может быть одобрен**

Ваш результат: ${result.percentage}% соответствия (минимум: ${result.minScoreForCredit}%)

Причины отказа:
${result.reasons.map(r => `• ${r}`).join('\n')}

💡 **Рекомендации:**
• Поработайте над указанными факторами
• Попробуйте подать заявку через 3-6 месяцев
• Рассмотрите возможность:
  - Меньшей суммы кредита
  - Кредита с залогом
  - Привлечения поручителя

Хотите узнать подробнее о причинах отказа?`;
    }
  }
}