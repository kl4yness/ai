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

  // 🔥 ОДНА МОДЕЛЬ
  const model = "nvidia/nemotron-3-super-120b-a12b:free";

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
        temperature: 0.1,
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
      throw new Error(`API error: ${res.status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      console.error("❌ JSON parse error");
      throw new Error("JSON parse error");
    }

    // ✅ Простое извлечение заголовка
    let rawTitle: string | null = null;
    const message = data?.choices?.[0]?.message;

    if (message?.content && message.content.trim() !== '') {
      rawTitle = message.content.trim();
    }

    if (!rawTitle) {
      console.warn(`⚠️ Пустой заголовок от ${model}`);
      throw new Error("Empty title");
    }

    // 🔧 Чистим
    let title = rawTitle
      .replace(/["'"]/g, '')
      .replace(/^(заголовок|название|тема|кратко|назови):?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Обрезаем до 5 слов
    const words = title.split(/\s+/);
    if (words.length > 5) {
      title = words.slice(0, 5).join(' ');
    }

    if (!title || title.length === 0) {
      console.warn(`⚠️ Заголовок от ${model} пустой после чистки`);
      throw new Error("Empty title after cleaning");
    }

    console.log(`✅ Заголовок от ${model}: ${title}`);

    setChatTitle(chatId, title);

  } catch (error: any) {
    console.error(`❌ Ошибка генерации заголовка:`, error);
    
    // ❌ Fallback — первые 4 слова сообщения
    const fallback = cleanMessage.split(/\s+/).slice(0, 4).join(" ");
    setChatTitle(chatId, fallback.slice(0, 50) || "Диалог");
  }
}
