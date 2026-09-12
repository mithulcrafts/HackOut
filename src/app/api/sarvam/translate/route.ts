import { NextResponse } from "next/server";
import { z } from "zod";
import { sarvamTranslate } from "@/lib/sarvam";
const schema = z.object({ text: z.string().trim().min(1).max(2000), targetLanguageCode: z.string().regex(/^[a-z]{2}-IN$/) });
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Text and language are required." }, { status: 400 }); try { return NextResponse.json({ text: await sarvamTranslate(parsed.data.text, parsed.data.targetLanguageCode) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Translation unavailable." }, { status: 503 }); } }
