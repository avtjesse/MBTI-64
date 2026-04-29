import { animalData } from "../src/data/animals";
import type { MBTIResult } from "../src/services/gemini";

const model = "gemini-2.5-flash";

function buildPrompt(result: MBTIResult) {
  const animalInfo = animalData[result.typeCode] || {
    animal: "Unknown Animal",
    emoji: "🦊",
    groupName: "Unknown Group",
    suffixName: "Unknown Type",
  };

  return `
你是一位擅长人格分析的顾问，请使用繁体中文撰写一篇 MBTI 64 型深度解析。

对象资料：
- 名字：${result.name}
- 性别：${result.gender}
- 生日：${result.birthday}
- 星座：${result.zodiac}
- 血型：${result.bloodType}
- MBTI 64 型：${result.typeCode}
- 动物人格：${animalInfo.animal} ${animalInfo.emoji}（${animalInfo.groupName} / ${animalInfo.suffixName}）

六大维度分数（0 到 100，越高越偏向前者）：
- E / I：${result.scores.EI}
- S / N：${result.scores.SN}
- T / F：${result.scores.TF}
- J / P：${result.scores.JP}
- A / O：${result.scores.AO}
- H / C：${result.scores.HC}

请输出 600 到 800 字，内容包含：
1. 核心人格气质
2. 优势与潜能
3. 可能盲点与压力反应
4. 2 到 3 条可执行建议

输出要求：
- 使用 Markdown
- 加上小标题
- 语气自然、具体、有洞察
- 以 MBTI 与分数为主，星座与血型仅作轻度辅助
- 不要输出 JSON
`;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }

    const maybeError = (error as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown server error";
    }
  }

  return "Unknown server error";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    return;
  }

  const result = req.body?.result as MBTIResult | undefined;
  if (!result) {
    res.status(400).json({ error: "Missing result payload" });
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildPrompt(result),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({
        error: errorText || `Gemini API request failed with status ${response.status}`,
      });
      return;
    }

    const data = await response.json();
    const analysis =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || "")
        .join("")
        .trim() || "";

    if (!analysis) {
      res.status(502).json({ error: "Gemini returned an empty response" });
      return;
    }

    res.status(200).json({ analysis });
  } catch (error) {
    const message = normalizeError(error);
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: message });
  }
}
