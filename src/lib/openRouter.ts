import { z } from "zod";

const COMPLETION_RESPONSE_SCHEMA = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.union([z.string(), z.array(z.any())]),
      }),
    })
  ),
});

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

function extractTextFromContent(content: string | z.infer<typeof COMPLETION_RESPONSE_SCHEMA>["choices"][number]["message"]["content"]) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

function cleanRulesOutput(raw: string, biomolecules: string[]) {
  const normalizedNodes = biomolecules.map((name) => name.toLowerCase());
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+\.|[-*])\s*/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      const lower = line.toLowerCase();
      const mentionsKnownNode = normalizedNodes.some((name) => lower.includes(name));
      const mentionsPhenotype = /phenotype/.test(lower);
      return mentionsKnownNode && !mentionsPhenotype;
    });
}

export async function inferRulesFromBiomolecules(biomolecules: string[]) {
  if (!biomolecules.length) {
    throw new Error("Biomolecules list is empty.");
  }

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key missing. Set VITE_OPENROUTER_API_KEY in your environment.");
  }

  const trimmed = biomolecules.map((b) => b.trim()).filter(Boolean);
  if (!trimmed.length) {
    throw new Error("Provide at least one biomolecule after trimming input.");
  }

  const systemPrompt = `You are a biomedical network inference assistant. Use only the biomolecules provided by the user. Do not invent or infer new entities, phenotypes, diseases, or pathways. Produce boolean-style regulatory rules with the following requirements:\n- Exactly one rule per target node\n- Each rule must use the syntax: TARGET = EXPRESSION\n- EXPRESSIONS may include the operators && (AND), || (OR), and ! (NOT) as well as parentheses\n- Only the provided biomolecule identifiers may appear in the rules\n- Output only the rules, no commentary or numbering.`;

  const userPrompt = `Biomolecules (only use these names in your rules):\n${trimmed.map((name) => `- ${name}`).join("\n")}\n\nGenerate one rule per target node using the format TARGET = EXPRESSION, where the expression can combine the biomolecules with && (AND), || (OR), ! (NOT), and parentheses. Do not include numbering, bullet points, or any text outside the rules.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "http://localhost",
      "X-Title": "Biological Network Inference",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${message}`);
  }

  const data = COMPLETION_RESPONSE_SCHEMA.safeParse(await response.json());
  if (!data.success) {
    throw new Error("Unexpected OpenRouter response format.");
  }

  const content = extractTextFromContent(data.data.choices[0]?.message?.content ?? "");
  const rules = cleanRulesOutput(content, trimmed);
  return rules;
}
