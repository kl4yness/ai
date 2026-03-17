'use client';

import { useChatStore } from "@/store/chatStore";
import { useEffect, useState } from "react";

export function CreditStatus() {
  const { activeChatId, chats } = useChatStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !activeChatId) return null;

  const currentChat = chats[activeChatId];
  if (!currentChat?.creditResult) return null;

  const result = currentChat.creditResult;

  return (
    <div className={`p-4 rounded-lg mb-4 ${
      result.approved ? 'bg-green-100' : 'bg-red-100'
    }`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-lg">
          {result.approved ? '✅ Предварительное одобрение' : '❌ Предварительный отказ'}
        </h3>
        <span className="text-2xl font-bold">{result.percentage}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
        <div
          className={`h-2.5 rounded-full ${
            result.approved ? 'bg-green-600' : 'bg-red-600'
          }`}
          style={{ width: `${result.percentage}%` }}
        />
      </div>

      {result.reasons.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold mb-1">Ключевые факторы:</p>
          <ul className="list-disc list-inside space-y-1">
            {result.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {!result.approved && (
        <p className="text-sm mt-2">
          Минимальный порог: {result.minScoreForCredit}%
        </p>
      )}
    </div>
  );
}