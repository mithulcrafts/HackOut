const endpoint = "https://api.sarvam.ai";
function key() { return process.env.SARVAM_API_KEY; }
export async function sarvamTranslate(input: string, targetLanguageCode: string) {
  const apiKey = key(); if (!apiKey) throw new Error("Sarvam is not configured.");
  const response = await fetch(`${endpoint}/translate`, { method: "POST", headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ input, source_language_code: "en-IN", target_language_code: targetLanguageCode, model: "mayura:v1" }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Translation service unavailable.");
  const body = await response.json() as { translated_text?: string }; if (!body.translated_text) throw new Error("Translation response was empty."); return body.translated_text;
}
export async function sarvamSpeech(input: string, targetLanguageCode: string) {
  const apiKey = key(); if (!apiKey) throw new Error("Sarvam is not configured.");
  const response = await fetch(`${endpoint}/text-to-speech`, { method: "POST", headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ inputs: [input], target_language_code: targetLanguageCode, speaker: "meera", model: "bulbul:v3" }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Voice service unavailable.");
  const body = await response.json() as { audios?: string[] }; if (!body.audios?.[0]) throw new Error("Voice response was empty."); return body.audios[0];
}
