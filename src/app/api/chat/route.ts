import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API ключ не настроен" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();

    const messages = body.messages.map((msg: any) => ({
      role: msg.role,
      content: String(msg.content),
    }));

    const requestBody = {
      model: 'openrouter/hunter-alpha',
      messages,
      temperature: body.temperature ?? 0.3,
      max_tokens: body.max_tokens ?? 500,
    };

    console.log("➡️ Запрос к OpenRouter:", requestBody.model);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
          "X-Title": process.env.SITE_NAME || "Credit Consultant",
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("❌ OpenRouter ERROR:");
      console.error("Status:", response.status);
      console.error("Body:", errorText);

      return NextResponse.json(
        {
          error: "OpenRouter error",
          status: response.status,
          details: errorText,
        },
        { status: response.status },
      );
    }

    // ✅ Парсим JSON безопасно
    let data;

    try {
      data = await response.json();
    } catch (e) {
      console.error("❌ Не удалось распарсить JSON");

      return NextResponse.json(
        { error: "Неверный JSON от OpenRouter" },
        { status: 500 },
      );
    }

    // ✅ Проверяем структуру
    if (!data?.choices?.[0]?.message) {
      console.error("❌ Неправильная структура ответа:", data);

      return NextResponse.json(
        { error: "Неверная структура ответа" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("💥 Ошибка в API роуте:", error);

    return NextResponse.json(
      {
        error: "Внутренняя ошибка сервера",
        details: error?.message || "Неизвестная ошибка",
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
