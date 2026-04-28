export interface MBTIResult {
  name: string;
  gender: string;
  birthday: string;
  bloodType: string;
  zodiac: string;
  typeCode: string; // e.g., INTJ-A-H
  scores: {
    EI: number;
    SN: number;
    TF: number;
    JP: number;
    AO: number;
    HC: number;
  };
}

export async function getDeepAnalysis(result: MBTIResult) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ result }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to generate analysis");
  }

  const data = await response.json();
  return data.analysis as string;
}
