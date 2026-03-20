import { useChatStore } from "@/store/chatStore";
import { nanoid } from "nanoid";
import type { Message } from "@/types/Message";
import { CreditScoring } from "@/lib/creditScoring";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestAI(messages: Message[], chatId: string) {
  const { setIsLoading, chats, addMessage, setChatTitle } =
    useChatStore.getState();

  setIsLoading(true);

  try {
    const currentChat = chats[chatId];
    if (!currentChat) throw new Error("Чат не найден");

    let userData = currentChat.creditData || {};
    const scoring = CreditScoring.getInstance();

    const lastUserMessage = messages.filter((m) => m.role === "user").pop();

    // 🔹 Обновляем данные пользователя
    if (lastUserMessage) {
      userData = scoring.extractDataFromMessage(
        lastUserMessage.message,
        userData,
      );

      useChatStore.setState({
        chats: {
          ...chats,
          [chatId]: {
            ...currentChat,
            creditData: userData,
          },
        },
      });
    }

    // 🔹 Если все данные есть — считаем локально
    if (scoring.hasAllData(userData)) {
      const result = scoring.calculateScore(userData);

      useChatStore.setState({
        chats: {
          ...chats,
          [chatId]: {
            ...currentChat,
            creditData: userData,
            creditResult: result,
          },
        },
      });

      const finalAnswer = scoring.generateFinalResponse(result);

      addMessage(chatId, {
        id: nanoid(),
        role: "assistant",
        message: finalAnswer,
        sendedAt: new Date().toISOString(),
      });

      if (currentChat.title === "Новый чат") {
        setChatTitle(
          chatId,
          `Кредит: ${result.approved ? "✅" : "❌"} ${result.percentage}%`,
        );
      }

      return;
    }

    // 🔹 Формируем prompt
    const systemPrompt = scoring.getSystemPrompt(userData, currentChat.title);

    const openRouterMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.message,
      })),
    ];

    // 🔥 НОРМАЛЬНЫЕ модели
    const models = ["deepseek/deepseek-chat-v3-0324:free",     
  "google/gemini-2.0-flash-exp:free",         
  "nvidia/nemotron-3-super-120b-a12b:free",          
  "qwen/qwen3-next-80b-a3b-instruct:free"];

    let lastError: any = null;

    // 🔁 Перебор моделей
    for (const model of models) {
      try {
        console.log(`🔄 Пробуем модель: ${model}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: openRouterMessages,
            temperature: 0.3,
            max_tokens: 500,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // ❌ Ошибка ответа
        if (!response.ok) {
          let errorData;

          try {
            errorData = await response.json();
          } catch {
            errorData = await response.text();
          }

          console.log(`❌ ${model} ошибка ${response.status}:`, errorData);
          lastError = errorData;

          if (response.status === 429) {
            console.log(`⏳ Rate limit, ждём...`);
            await delay(3000);
          }

          await delay(1500);
          continue;
        }

        // ✅ Парсим JSON
        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.error(`❌ JSON parse error от ${model}`);
          lastError = e;
          await delay(1500);
          continue;
        }

        console.log("📦 Ответ модели:", data);

       console.log("📦 Ответ модели:", data);

// ✅ Безопасное извлечение текста из разных форматов
let answer: string | null = null;
const choice = data?.choices?.[0];
const message = choice?.message;
const delta = choice?.delta;

// 1. Сначала пробуем взять content
if (message?.content && message.content.trim() !== '') {
  answer = message.content.trim();
}
// 2. Если content пустой, но есть reasoning (модель думает)
else if (message?.reasoning && message.reasoning.trim() !== '') {
  console.log(`🧠 Модель ${model} вернула reasoning вместо content`);
  answer = message.reasoning.trim();
}
// 3. Для стриминговых ответов
else if (delta?.content && delta.content.trim() !== '') {
  answer = delta.content.trim();
}
// 4. Для некоторых моделей (text-поле)
else if (choice?.text && choice.text.trim() !== '') {
  answer = choice.text.trim();
}
// 5. Если finish_reason = "length" — обрезано из-за лимита
else if (choice?.finish_reason === 'length') {
  console.warn(`⚠️ Ответ от ${model} обрезан из-за max_tokens`);
  // Берём то, что есть в reasoning (даже если неполное)
  if (message?.reasoning) {
    answer = message.reasoning.trim() + "... (ответ обрезан)";
  }
}

// Если всё ещё пусто — логируем и пропускаем модель
if (!answer || answer === '') {
  console.warn(`⚠️ Пустой ответ от ${model}`);
  console.warn('🔍 Структура:', JSON.stringify(data, null, 2).slice(0, 800));
  lastError = new Error("Empty response");
  await delay(1500);
  continue;
}

console.log(`✅ Успешный ответ от ${model}:`, answer.slice(0, 150));
        addMessage(chatId, {
          id: nanoid(),
          role: "assistant",
          message: answer,
          sendedAt: new Date().toISOString(),
        });

        // 🔹 Устанавливаем заголовок
        if (
          currentChat.title === "Новый чат" &&
          Object.keys(userData).length > 0
        ) {
          const lastMsg = lastUserMessage?.message.toLowerCase() || "";

          let creditType = "кредит";
          if (lastMsg.includes("ипотек")) creditType = "ипотека";
          else if (lastMsg.includes("авто")) creditType = "автокредит";
          else if (lastMsg.includes("потреб")) creditType = "потребительский";

          setChatTitle(chatId, `Заявка на ${creditType}`);
        }

        return;
      } catch (error: any) {
        console.error(`❌ Ошибка у модели ${model}:`, error);
        lastError = error;

        if (error.name === "AbortError") {
          console.log(`⏱️ Таймаут ${model}`);
        }

        await delay(2000);
      }
    }

    // ❌ Все модели умерли
    console.error("💥 Все модели недоступны:", lastError);

    addMessage(chatId, {
      id: nanoid(),
      role: "assistant",
      message: "Сейчас нейросеть перегружена. Попробуй чуть позже 🙏",
      sendedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("💥 Критическая ошибка:", error);

    addMessage(chatId, {
      id: nanoid(),
      role: "assistant",
      message: "Произошла ошибка. Обнови страницу и попробуй снова.",
      sendedAt: new Date().toISOString(),
    });
  } finally {
    setIsLoading(false);
  }
}
