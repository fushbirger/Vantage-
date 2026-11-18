import "server-only";
import { parseAmountToCents } from "./currency";
import type {
  CurrencyCode,
  PaymentScreenshotCheck,
  ScannedReceipt,
} from "./types";
import { isCategory, isCurrencyCode } from "./validation";

export class VisionError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function visionStatus(): { configured: boolean; model: string } {
  return {
    configured: Boolean(process.env.VISION_API_KEY ?? process.env.OPENAI_API_KEY),
    model: process.env.VISION_MODEL ?? "gpt-4o-mini",
  };
}

function endpoint(): string {
  return (
    process.env.VISION_API_URL ??
    "https://api.openai.com/v1/chat/completions"
  );
}

function apiKey(): string {
  return process.env.VISION_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new VisionError("The vision model returned an unreadable response.");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new VisionError("The vision model returned invalid JSON.");
  }
}

async function callVision(
  system: string,
  prompt: string,
  imageDataUrl: string,
): Promise<Record<string, unknown>> {
  if (!visionStatus().configured) {
    throw new VisionError(
      "Vision AI is not configured. Add VISION_API_KEY to use receipt scanning.",
      503,
    );
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: visionStatus().model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new VisionError(
      `Vision API ${response.status}: ${detail || "request failed"}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              part && typeof part === "object" && "text" in part
                ? String((part as { text: unknown }).text)
                : "",
            )
            .join("")
        : "";
  if (!text) throw new VisionError("The vision model returned no content.");
  return extractJson(text) as Record<string, unknown>;
}

function asText(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  if (typeof value === "string") {
    return Math.max(0, parseAmountToCents(value));
  }
  return 0;
}

function asConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

function asCurrency(value: unknown): CurrencyCode {
  return isCurrencyCode(value) ? value : "BND";
}

const RECEIPT_SYSTEM =
  "You extract structured data from photos of shopping, restaurant and service receipts. " +
  "Return only a JSON object. Never invent amounts. If a field is unclear, use an empty string, null or 0.";

/**
 * One Vision LLM call replaces a pile of custom OCR parsing rules. The model is
 * asked for clean JSON; all values are validated and normalised server-side.
 */
export async function scanReceipt(
  imageDataUrl: string,
): Promise<ScannedReceipt> {
  const raw = await callVision(
    RECEIPT_SYSTEM,
    `Read this receipt and return JSON with this exact shape:
{
  "merchant": "shop or restaurant name",
  "title": "short expense title",
  "date": "YYYY-MM-DD or null",
  "currency": "BND" | "MYR" | "SGD" | "USD",
  "total": 12.34,
  "items": [{ "name": "item", "amount": 1.20 }],
  "category": "general" | "food" | "groceries" | "transport" | "stay" | "gift" | "activity",
  "confidence": 0.0
}
Use the final amount actually paid as "total". Keep item names short. If the currency is unclear, use BND.`,
    imageDataUrl,
  );

  const date = asText(raw.date, 10);
  const merchant = asText(raw.merchant);
  const rawTitle = asText(raw.title, 120);
  const rawCurrency = asCurrency(raw.currency);
  const totalCents = asCents(raw.total);

  if (totalCents <= 0) {
    throw new VisionError(
      "The receipt total could not be read. Enter it manually or retake the photo.",
      422,
    );
  }

  const items = Array.isArray(raw.items)
    ? raw.items
        .slice(0, 50)
        .map((item) => {
          const record = (item ?? {}) as Record<string, unknown>;
          const name = asText(record.name, 80);
          const amountCents = asCents(record.amount);
          return name && amountCents > 0 ? { name, amountCents } : null;
        })
        .filter(
          (item): item is { name: string; amountCents: number } =>
            item !== null,
        )
    : [];

  return {
    merchant,
    title: rawTitle || merchant || "Scanned receipt",
    dateIso: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    currency: rawCurrency,
    totalCents,
    items,
    category:
      typeof raw.category === "string" && isCategory(raw.category)
        ? raw.category
        : "general",
    confidence: asConfidence(raw.confidence),
  };
}

/**
 * Check a payment screenshot against the amount a creditor expects. The model
 * is only a hint; the recipient always keeps a manual "Mark as paid" override.
 */
export async function verifyPaymentScreenshot(
  imageDataUrl: string,
  expectedBndCents: number,
): Promise<PaymentScreenshotCheck> {
  const raw = await callVision(
    "You inspect screenshots of banking and wallet payment confirmations. Return only a JSON object. " +
      "Do not claim a payment succeeded unless the screenshot clearly shows a completed transfer.",
    `This should be a payment screenshot for BND ${(expectedBndCents / 100).toFixed(2)}.
Return JSON with this exact shape:
{
  "isPaymentScreenshot": true,
  "extractedAmount": 68.15,
  "reference": "transaction reference or empty string",
  "confidence": 0.0,
  "reason": "one short sentence explaining what you saw"
}
Use null for extractedAmount when no amount is visible. The expected amount is BND ${(expectedBndCents / 100).toFixed(2)}.`,
    imageDataUrl,
  );

  const extractedAmountCents =
    raw.extractedAmount === null || raw.extractedAmount === undefined
      ? null
      : asCents(raw.extractedAmount);
  const amountMatches =
    extractedAmountCents === null
      ? null
      : Math.abs(extractedAmountCents - expectedBndCents) <= 1;

  return {
    isPaymentScreenshot: raw.isPaymentScreenshot === true,
    extractedAmountCents:
      extractedAmountCents && extractedAmountCents > 0
        ? extractedAmountCents
        : null,
    amountMatches,
    reference: asText(raw.reference, 120) || null,
    confidence: asConfidence(raw.confidence),
    reason:
      asText(raw.reason, 300) ||
      "No explanation was returned by the vision model.",
  };
}
