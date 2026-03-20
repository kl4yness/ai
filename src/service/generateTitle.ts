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
  const models = ["deepseek/deepseek-chat-v3-0324:free",     
  "google/gemini-2.0-flash-exp:free",         
  "nvidia/nemotron-3-super-120b-a12b:free",          
  "qwen/qwen3-next-80b-a3b-instruct:free"];


  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`🔄 Генерация заголовка: ${model}`);

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
                "Ты создаёшь короткие названия чатов. Ответ — ТОЛЬКО заголовок (3-5 слов), без кавычек.",
            },
            {
              role: "user",
              content: cleanMessage,
            },
          ],
          temperature: 0.3,
          max_tokens: 20,
        }),
      });

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

      const rawTitle = data?.choices?.[0]?.message?.content?.trim();

      if (!rawTitle) {
        console.error("❌ Пустой заголовок", data);
        continue;
      }

      // 🔧 Чистим ответ
      let title = rawTitle
        .replace(/["']/g, "")
        .replace(/[^\p{L}\p{N}\s.,!?-]/gu, "")
        .trim();

      if (!title) {
        throw new Error("Empty title after clean");
      }

      if (title.length > 50) {
        title = title.slice(0, 47) + "...";
      }

      console.log(`✅ Заголовок: ${title}`);

      setChatTitle(chatId, title);
      return;
    } catch (error) {
      console.error(`❌ Ошибка модели ${model}:`, error);
      lastError = error;
    }
  }

  // ❌ fallback если всё умерло
  console.error("💥 Не удалось сгенерировать заголовок:", lastError);

  const fallback = cleanMessage.split(" ").slice(0, 4).join(" ");
  setChatTitle(chatId, fallback || "Новый диалог");
}
