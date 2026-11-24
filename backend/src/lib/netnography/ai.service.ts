import axios from "axios";

export async function callNetnographyAIJson<T = any>(
  systemPrompt: string,
  userPrompt: string,
  fallbackJson: T
): Promise<{ data: T; model: string }> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    if (geminiKey) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await axios.post(
        url,
        {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.25 },
        },
        { timeout: 90_000 }
      );
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return { data: JSON.parse(text.replace(/```json\s*|```/g, "").trim()), model };
    }

    if (anthropicKey) {
      const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
      const res = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model,
          max_tokens: 4096,
          system: `${systemPrompt}\n\nDevuelve ÚNICAMENTE JSON válido sin bloques de markdown.`,
          messages: [{ role: "user", content: userPrompt }],
        },
        {
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          timeout: 90_000,
        }
      );
      const text = res.data?.content?.[0]?.text || "{}";
      return { data: JSON.parse(text.replace(/```json\s*|```/g, "").trim()), model };
    }

    if (openaiKey) {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        {
          headers: { Authorization: `Bearer ${openaiKey}` },
          timeout: 90_000,
        }
      );
      const text = res.data?.choices?.[0]?.message?.content || "{}";
      return { data: JSON.parse(text), model };
    }
  } catch (err: any) {
    console.error("[Netnography AI Error]:", err?.message || err);
  }

  return { data: fallbackJson, model: "fallback" };
}
