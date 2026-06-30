import { generateObject } from "ai";
import type { z } from "zod";

/**
 * Dünner Wrapper um die AI SDK + Vercel AI Gateway.
 *
 * Bei einem Modell-String im Format `creator/model` ist das AI Gateway der
 * Default-Provider; der Schlüssel wird aus `AI_GATEWAY_API_KEY` gelesen.
 * Siehe https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
 */

export interface Metrik {
  input_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  total_tokens: number | null;
  dauer_ms: number | null;
  usd: number | null;
}

export interface ObjektErgebnis<T> {
  objekt: T;
  metrik: Metrik;
}

function leseMetrik(usage: unknown, providerMetadata: unknown, dauer_ms: number): Metrik {
  const u = (usage ?? {}) as Record<string, number | undefined>;
  const pm = (providerMetadata ?? {}) as Record<string, Record<string, unknown>>;
  // Gateway liefert Kosten i. d. R. unter providerMetadata.gateway.cost.
  const usdRaw = pm.gateway?.cost;
  const usd = typeof usdRaw === "number" ? usdRaw : usdRaw != null ? Number(usdRaw) : null;
  // Cache-Tokens: AI SDK (cachedInputTokens) oder anbieterspezifisch (Anthropic cacheReadInputTokens).
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  const cached =
    u.cachedInputTokens ??
    num(pm.anthropic?.cacheReadInputTokens) ??
    num(pm.openai?.cachedPromptTokens) ??
    null;
  return {
    input_tokens: u.inputTokens ?? u.promptTokens ?? null,
    output_tokens: u.outputTokens ?? u.completionTokens ?? null,
    cached_tokens: cached,
    total_tokens: u.totalTokens ?? null,
    dauer_ms: Math.round(dauer_ms),
    usd: Number.isFinite(usd as number) ? (usd as number) : null,
  };
}

export async function erzeugeObjekt<T>(opts: {
  modellId: string;
  schema: z.ZodType<T>;
  system: string;
  /** Großer, über viele Aufrufe IDENTISCHER Präfix (z. B. Wahlprogramm) → wird gecacht. */
  stabil?: string;
  /** Variabler Teil, der ganz ans Ende gehängt wird (z. B. die Persona). */
  variabel?: string;
  /** Einfacher Prompt-Modus (ohne Caching), wenn stabil/variabel nicht genutzt werden. */
  prompt?: string;
  temperatur: number;
}): Promise<ObjektErgebnis<T>> {
  const start = performance.now();

  // Caching-Modus: stabilen Block mit Anthropic-Cache-Breakpoint markieren, Variables danach.
  // OpenAI/Gemini cachen den identischen Präfix automatisch.
  const messages =
    opts.stabil != null
      ? [
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: opts.stabil,
                providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
              },
              { type: "text" as const, text: opts.variabel ?? "" },
            ],
          },
        ]
      : undefined;

  const res = await generateObject({
    model: opts.modellId,
    schema: opts.schema,
    system: opts.system,
    temperature: opts.temperatur,
    ...(messages ? { messages } : { prompt: opts.prompt ?? "" }),
  });
  const dauer = performance.now() - start;
  return {
    objekt: res.object as T,
    metrik: leseMetrik(res.usage, (res as { providerMetadata?: unknown }).providerMetadata, dauer),
  };
}
