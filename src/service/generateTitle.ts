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
    .trim()
    .slice(0, 200);

  if (!cleanMessage) {
    setChatTitle(chatId, "Диалог");
    return;
  }

  // 🔥 Модели
  const models = [
    "deepseek/deepseek-chat-v3-0324:free",  // DeepSeek ставим первой
    "google/gemini-2.0-flash-exp:free",
    "nvidia/nemotron-3-super-120b-a12b:free"
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
              role: "user",
              content: `Кратко назови этот разговор (3-5 слов): ${cleanMessage}`
            }
          ],
          temperature: 0.1,  // минимальная температура для предсказуемости
          max_tokens: 20,
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

      // ✅ Извлекаем ответ
      const choice = data?.choices?.[0];
      let rawTitle: string | null = null;

      if (choice?.message?.content?.trim()) {
        rawTitle = choice.message.content.trim();
      } else if (choice?.message?.reasoning?.trim()) {
        // Если пришло reasoning — возможно, модель не поняла задачу
        console.warn(`⚠️ Модель ${model} вернула reasoning вместо заголовка`);
        continue;  // пропускаем эту модель
      }

      if (!rawTitle) {
        console.warn(`⚠️ Пустой заголовок от ${model}`);
        continue;
      }

      // 🔧 Жёсткая очистка
      let title = rawTitle
        .replace(/["'"]/g, '')
        .replace(/^(заголовок|название|тема|кратко|назови):?\s*/i, '')
        .replace(/^(we need to|i need to|output|generate|create|make|provide)/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Обрезаем до 5 слов
      const words = title.split(/\s+/);
      if (words.length > 5) {
        title = words.slice(0, 5).join(' ');
      }

      // Если после чистки пусто или слишком длинно
      if (!title || title.length === 0 || title.length > 50) {
        console.warn(`⚠️ Заголовок от ${model} не прошёл валидацию`);
        continue;
      }

      // Дополнительная проверка: если заголовок похож на английскую инструкцию
      if (/^(we|i|you|the|please|here|this|that)/i.test(title)) {
        console.warn(`⚠️ Заголовок от ${model} похож на инструкцию: ${title}`);
        continue;
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
  setChatTitle(chatId, fallback.slice(0, 50) || "Диалог");
}
