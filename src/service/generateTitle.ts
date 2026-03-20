import { useChatStore } from "@/store/chatStore";
import type { Message } from "@/types/Message";

export async function generateTitle(messages: Message[], chatId: string) {
  const setChatTitle = useChatStore.getState().setChatTitle;

  const firstUserMessage =
    messages.find((m) => m.role === "user")?.message || "";

  if (!firstUserMessage) {
    setChatTitle(chatId, "Новый чат");
    return;
  }

  // 🔧 Более безопасная очистка
  const cleanMessage = firstUserMessage
    .replace(/[^\p{L}\p{N}\s.,!?-]/gu, "")
    .trim();

  if (!cleanMessage) {
    setChatTitle(chatId, "Диалог");
    return;
  }

  // 🔥 Нормальные модели
  const models = [
    "google/gemini-2.0-flash-exp:free",  // Gemini ставим первой, у неё стабильный content
    "deepseek/deepseek-chat-v3-0324:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free"
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`🔄 Генерация заголовка: ${model}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Ты создаёшь короткие названия чатов. Ответ — ТОЛЬКО заголовок (3-5 слов), без кавычек, без пояснений.",
            },
            {
              role: "user",
              content: cleanMessage,
            },
          ],
          temperature: 0.3,
          max_tokens: 30,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let error;
        try {
          error = await res.json();
        } catch {
          error = await res.text();
        }

        console.error(`❌ Ошибка ${model}:`, error);
        lastError = error;
        continue;
      }

      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.error("❌ JSON parse error", e);
        continue;
      }

      // ✅ Улучшенное извлечение текста с поддержкой reasoning
      const choice = data?.choices?.[0];
      let rawTitle: string | null = null;

      // 1. Сначала content
      if (choice?.message?.content?.trim()) {
        rawTitle = choice.message.content.trim();
      }
      // 2. Если content пустой, но есть reasoning (Nvidia, DeepSeek)
      else if (choice?.message?.reasoning?.trim()) {
        console.log(`🧠 ${model} вернул заголовок через reasoning`);
        rawTitle = choice.message.reasoning.trim();
      }
      // 3. Для стриминга
      else if (choice?.delta?.content?.trim()) {
        rawTitle = choice.delta.content.trim();
      }

      if (!rawTitle) {
        console.warn(`⚠️ Пустой заголовок от ${model}`);
        continue;
      }

      // 🔧 Чистим ответ
      let title = rawTitle
        .replace(/["']/g, "")
        .replace(/[^\p{L}\p{N}\s.,!?-]/gu, "")
        .trim();

      // Если после чистки ничего не осталось — пробуем следующую модель
      if (!title) {
        console.warn(`⚠️ Заголовок от ${model} стал пустым после чистки`);
        continue;
      }

      // Обрезаем длинные заголовки
      if (title.length > 50) {
        title = title.slice(0, 47) + "...";
      }

      console.log(`✅ Заголовок от ${model}: ${title}`);

      setChatTitle(chatId, title);
      return;

    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log(`⏱️ Таймаут модели ${model}`);
      } else {
        console.error(`❌ Ошибка модели ${model}:`, error);
      }
      lastError = error;
    }
  }

  // ❌ fallback если всё умерло
  console.error("💥 Не удалось сгенерировать заголовок:", lastError);

  const fallback = cleanMessage.split(" ").slice(0, 4).join(" ");
  setChatTitle(chatId, fallback.slice(0, 50) || "Новый диалог");
}
