import { NextResponse } from "next/server";
import { z } from "zod";
import { SARVAM_LANGUAGE_CODES, SarvamSpeechError, sarvamSpeech } from "@/lib/sarvam";
const schema = z.object({ text: z.string().trim().min(1).max(1000), targetLanguageCode: z.enum(SARVAM_LANGUAGE_CODES) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Text and language are required." }, { status: 400 });
  try {
    const result = await sarvamSpeech(parsed.data.text, parsed.data.targetLanguageCode);
    return NextResponse.json({ audio: result.audio, text: result.text, languageCode: result.languageCode, mimeType: "audio/wav" });
  } catch (error) {
    if (error instanceof SarvamSpeechError) return NextResponse.json({ error: error.message, text: error.text, languageCode: error.languageCode }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice unavailable." }, { status: 503 });
  }
}
