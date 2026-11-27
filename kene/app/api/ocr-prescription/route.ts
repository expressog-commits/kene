import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_IMAGE_DATA_URL_LENGTH = 4_500_000;
const IMAGE_DATA_URL_RE =
  /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const GEMINI_TIMEOUT_MS = 12_000;
const OCR_PROMPT =
  "Transcris uniquement les lignes de médicaments lisibles sur cette ordonnance médicale (nom commercial ou DCI, dosage, forme), une ligne par médicament, sans commentaire ni conseil médical.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const imageDataUrl =
    body && typeof body === "object" && "imageDataUrl" in body
      ? (body as { imageDataUrl?: unknown }).imageDataUrl
      : undefined;

  if (typeof imageDataUrl !== "string") {
    return NextResponse.json(
      { error: "Format d'image invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return NextResponse.json(
      { error: "Image trop volumineuse." },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  const match = IMAGE_DATA_URL_RE.exec(imageDataUrl);
  if (!match) {
    return NextResponse.json(
      { error: "Format d'image invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { available: false, text: "" },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  }

  const subtype = match[1] === "jpg" ? "jpeg" : match[1];
  const mimeType = `image/${subtype}`;
  const base64Data = match[2];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: OCR_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { available: false, text: "" },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const extractedText = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    return NextResponse.json(
      { available: true, text: extractedText },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { available: false, text: "" },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
