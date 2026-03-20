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

  // 🔧 Очищаем сообщение
  const cleanMessage = firstUserMessage
    .replace(/[^\p{L}\p{N}\s.,!?-]/gu, "")
    .trim();

  if (!cleanMessage) {
    setChatTitle(chatId, "Диалог");
    return;
  }

  // 🔥 Модели (Gemini первая, она стабильнее)
  const models = [
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free"
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`🔄 Генерация заголовка: ${model}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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
              content: "Ты — утилита для создания коротких заголовков чатов. Твоя задача: проанализировать сообщение пользователя и выдать ТОЛЬКО заголовок из 3-5 слов на русском языке. НЕ пиши ничего кроме заголовка. НЕ объясняй свои действия. НЕ используй кавычки."
            },
            {
              role: "user",
              content: `Сообщение пользователя: "${cleanMessage}"\n\nЗаголовок чата (3-5 слов):`
            }
          ],
          temperature: 0.2,  // низкая температура для более детерминированного ответа
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
      } catch {
        console.error("❌ JSON parse error");
        continue;
      }

      // ✅ Извлечение с поддержкой reasoning
      const choice = data?.choices?.[0];
      let rawTitle: string | null = null;

      if (choice?.message?.content?.trim()) {
        rawTitle = choice.message.content.trim();
      } else if (choice?.message?.reasoning?.trim()) {
        console.log(`🧠 ${model} вернул заголовок через reasoning`);
        rawTitle = choice.message.reasoning.trim();
      } else if (choice?.delta?.content?.trim()) {
        rawTitle = choice.delta.content.trim();
      }

      if (!rawTitle) {
        console.warn(`⚠️ Пустой заголовок от ${model}`);
        continue;
      }

      // 🔧 Жёсткая очистка — убираем всё, что не похоже на заголовок
      let title = rawTitle
        .replace(/["'"]/g, '')                          // убираем кавычки
        .replace(/^(заголовок|название|тема):\s*/i, '') // убираем префиксы
        .replace(/\s+/g, ' ')                           // нормализуем пробелы
        .trim();

      // Если получилась длинная фраза — обрезаем до 5 слов
      const words = title.split(/\s+/);
      if (words.length > 5) {
        title = words.slice(0, 5).join(' ');
      }

      // Если после чистки всё ещё пусто — пропускаем модель
      if (!title || title.length === 0) {
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

  // ❌ Fallback — первые 4 слова сообщения
  console.error("💥 Не удалось сгенерировать заголовок:", lastError);

  const fallback = cleanMessage.split(/\s+/).slice(0, 4).join(" ");
  setChatTitle(chatId, fallback.slice(0, 50) || "Новый диалог");
}
