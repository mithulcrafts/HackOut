import { NextResponse } from "next/server";
import { z } from "zod";
import { SARVAM_LANGUAGE_CODES, sarvamTranslate } from "@/lib/sarvam";
const schema = z.object({ text: z.string().trim().min(1).max(1000), targetLanguageCode: z.enum(SARVAM_LANGUAGE_CODES) });
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Text and language are required." }, { status: 400 }); try { return NextResponse.json({ text: await sarvamTranslate(parsed.data.text, parsed.data.targetLanguageCode) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Translation unavailable." }, { status: 503 }); } }
