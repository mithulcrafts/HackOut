const endpoint = "https://api.sarvam.ai";

export const SARVAM_LANGUAGE_CODES = ["en-IN", "gu-IN", "hi-IN", "mr-IN", "ta-IN", "te-IN", "bn-IN"] as const;
export type SarvamLanguageCode = (typeof SARVAM_LANGUAGE_CODES)[number];
export function isSarvamLanguageCode(value: string): value is SarvamLanguageCode {
  return (SARVAM_LANGUAGE_CODES as readonly string[]).includes(value);
}

function apiKey() {
  const value = process.env.SARVAM_API_KEY?.trim();
  if (!value) throw new Error("Sarvam is not configured.");
  return value;
}

function providerMessage(response: Response, fallback: string) {
  return response.status === 429 ? "Sarvam is temporarily busy. Please try again." : fallback;
}

/** Translate UI copy into the selected Indian language. */
export async function sarvamTranslate(input: string, targetLanguageCode: string): Promise<string> {
  if (!isSarvamLanguageCode(targetLanguageCode)) throw new Error("Unsupported language.");
  if (targetLanguageCode === "en-IN") return input;
  const response = await fetch(`${endpoint}/translate`, {
    method: "POST",
    headers: { "api-subscription-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ input, source_language_code: "auto", target_language_code: targetLanguageCode, model: "mayura:v1", mode: "modern-colloquial" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(providerMessage(response, "Translation service unavailable."));
  const body = (await response.json()) as { translated_text?: unknown };
  if (typeof body.translated_text !== "string" || !body.translated_text.trim()) throw new Error("Translation response was empty.");
  return body.translated_text;
}

export type SarvamSpeechResult = { audio: string; text: string; languageCode: SarvamLanguageCode };
export class SarvamSpeechError extends Error {
  constructor(message: string, readonly text: string, readonly languageCode: SarvamLanguageCode) {
    super(message);
    this.name = "SarvamSpeechError";
  }
}

/** Translate first (when needed), then synthesize with a bulbul:v3 voice. */
export async function sarvamSpeech(input: string, targetLanguageCode: string): Promise<SarvamSpeechResult> {
  if (!isSarvamLanguageCode(targetLanguageCode)) throw new Error("Unsupported language.");
  const localizedText = await sarvamTranslate(input, targetLanguageCode);
  const response = await fetch(`${endpoint}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ text: localizedText, language_code: targetLanguageCode, speaker: "shubh", model: "bulbul:v3", output_audio_codec: "wav", speech_sample_rate: 24000 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new SarvamSpeechError(providerMessage(response, "Voice service unavailable."), localizedText, targetLanguageCode);
  const body = (await response.json()) as { audios?: unknown };
  if (!Array.isArray(body.audios) || typeof body.audios[0] !== "string" || !body.audios[0]) throw new SarvamSpeechError("Voice response was empty.", localizedText, targetLanguageCode);
  return { audio: body.audios[0], text: localizedText, languageCode: targetLanguageCode };
}
