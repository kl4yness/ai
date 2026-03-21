import { useChatStore } from "@/store/chatStore";
import { nanoid } from "nanoid";
import type { Message } from "@/types/Message";
import { CreditScoring } from "@/lib/creditScoring";

export async function requestAI(messages: Message[], chatId: string) {
  const { setIsLoading, chats, addMessage, setChatTitle } =
    useChatStore.getState();

  setIsLoading(true);

  try {
    const currentChat = chats[chatId];
    if (!currentChat) throw new Error("Чат не найден");

    // 🔥 Если диалог уже завершён — не отвечаем
    if (currentChat.isCompleted) {
      addMessage(chatId, {
        id: nanoid(),
        role: "assistant",
        message: "✅ Ваша заявка уже рассмотрена. Для новой заявки создайте новый чат.",
        sendedAt: new Date().toISOString(),
      });
      setIsLoading(false);
      return;
    }

    let userData = currentChat.creditData || {};
    const scoring = CreditScoring.getInstance();

    const lastUserMessage = messages.filter((m) => m.role === "user").pop();

    // 🔹 Обновляем данные пользователя
    if (lastUserMessage) {
      userData = scoring.extractDataFromMessage(
        lastUserMessage.message,
        userData,
      );

      // 🔥 Если нет работы — автоматически ставим доход 0
      if (userData.hasJob === false && userData.salary === undefined) {
        userData.salary = 0;
        console.log(`💰 Автоматически установлен доход 0 (нет работы)`);
      }

      useChatStore.setState({
        chats: {
          ...chats,
          [chatId]: {
            ...currentChat,
            creditData: userData,
          },
        },
      });

      // 🔥🔥🔥 Если нет работы и кредитная история уже есть — сразу выдаём результат
      if (userData.hasJob === false && userData.creditHistory !== undefined) {
        console.log(`🎯 Нет работы, кредитная история есть — сразу считаем результат`);
        
        const result = scoring.calculateScore(userData);
        
        useChatStore.setState({
          chats: {
            ...chats,
            [chatId]: {
              ...currentChat,
              creditData: userData,
              creditResult: result,
              isCompleted: true,
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
        
        setIsLoading(false);
        return;
      }

      // 🔥 Если только что узнали, что нет работы — сразу переходим к кредитной истории
      const justLearnedNoJob =
        userData.hasJob === false && currentChat.creditData?.hasJob !== false;

      if (justLearnedNoJob) {
        console.log(`🎯 Пользователь не работает, сразу спрашиваем про кредитную историю`);
        
        const nextQuestion =
          "Как у вас обстоит ситуация с кредитной историей? Были ли у вас ранее кредиты или просрочки?";
        
        addMessage(chatId, {
          id: nanoid(),
          role: "assistant",
          message: nextQuestion,
          sendedAt: new Date().toISOString(),
        });
        
        setIsLoading(false);
        return;
      }
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
            isCompleted: true,
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

    // 🔥 ОДНА МОДЕЛЬ
    const model = "nvidia/nemotron-3-super-120b-a12b:free";

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

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        console.error(`❌ Ошибка ${model}:`, errorData);
        throw new Error(`API error: ${response.status}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error(`❌ JSON parse error`);
        throw new Error("JSON parse error");
      }

      console.log("📦 Ответ модели:", data);

      let answer: string | null = null;
      const message = data?.choices?.[0]?.message;

      if (message?.content && message.content.trim() !== '') {
        answer = message.content.trim();
      }

      if (!answer || answer === '') {
        console.warn(`⚠️ Пустой ответ от ${model}`);
        throw new Error("Empty response");
      }

      console.log(`✅ Успешный ответ от ${model}:`, answer.slice(0, 150));

      addMessage(chatId, {
        id: nanoid(),
        role: "assistant",
        message: answer,
        sendedAt: new Date().toISOString(),
      });

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

    } catch (error: any) {
      console.error(`❌ Ошибка модели ${model}:`, error);
      
      addMessage(chatId, {
        id: nanoid(),
        role: "assistant",
        message: "Сейчас нейросеть перегружена. Попробуй чуть позже 🙏",
        sendedAt: new Date().toISOString(),
      });
    }

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