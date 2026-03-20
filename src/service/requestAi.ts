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
  "openai/gpt-oss-120b:free",          
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

        // ✅ Проверяем ответ
        const answer = data?.choices?.[0]?.message?.content?.trim();

        if (!answer) {
          console.error(`❌ Пустой ответ от ${model}`, data);
          lastError = new Error("Empty response");
          await delay(1500);
          continue;
        }

        // ✅ УСПЕХ
        console.log(`✅ Успешный ответ от ${model}`);

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
