import { GoogleGenAI } from "@google/genai";
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
請你擔任一位溫暖、具洞察力的 MBTI 64 型人格分析師。

使用者資料：
- 名字：${result.name}
- 性別：${result.gender}
- 生日：${result.birthday}
- 星座：${result.zodiac}
- 血型：${result.bloodType}
- MBTI 64 型：${result.typeCode}
- 對應動物人格：${animalInfo.animal} ${animalInfo.emoji}（${animalInfo.groupName} - ${animalInfo.suffixName}）

六大向度分數（0-100，越高越偏向前者）：
- E / I：${result.scores.EI}
- S / N：${result.scores.SN}
- T / F：${result.scores.TF}
- J / P：${result.scores.JP}
- A / O：${result.scores.AO}
- H / C：${result.scores.HC}

請用繁體中文撰寫一篇 600 到 800 字的深度分析，結合 MBTI、動物人格、星座與血型做整體解讀，但仍以 MBTI 與六維分數為主軸，不要寫得太玄。

請包含以下內容：
1. 核心人格總評：說明此人格最鮮明的氣質、思考模式與給人的感受。
2. 優勢與天賦：分析這類型在學習、工作、人際或決策上的優勢。
3. 盲點與壓力反應：描述可能的內耗、誤區與在壓力下的表現。
4. 可執行建議：給 2 到 3 點具體可落地的建議。

輸出要求：
- 使用 Markdown
- 加上清楚的小標題
- 語氣自然、真誠、有洞察
- 不要輸出 JSON
- 不要重複列資料
`;
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
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(result),
    });

    res.status(200).json({ analysis: response.text ?? "" });
  } catch (error) {
    console.error("Gemini API Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate analysis";
    res.status(500).json({ error: message });
  }
}
