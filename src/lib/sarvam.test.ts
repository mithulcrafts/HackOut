import { afterEach, describe, expect, it, vi } from "vitest";
import { sarvamSpeech, sarvamTranslate } from "./sarvam";

describe("Sarvam integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SARVAM_API_KEY;
  });

  it("translates before speaking in the selected language", async () => {
    process.env.SARVAM_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ translated_text: "ચાર્જિંગ સ્વીકારો" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ audios: ["base64-audio"] }), { status: 200 }));

    const result = await sarvamSpeech("Accept charging", "gu-IN");

    expect(result).toEqual({ audio: "base64-audio", text: "ચાર્જિંગ સ્વીકારો", languageCode: "gu-IN" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ source_language_code: "auto", target_language_code: "gu-IN" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ text: "ચાર્જિંગ સ્વીકારો", language_code: "gu-IN", speaker: "shubh", model: "bulbul:v3" });
  });

  it("does not call translation for English speech", async () => {
    process.env.SARVAM_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ audios: ["audio"] }), { status: 200 }));
    const result = await sarvamSpeech("Accept charging", "en-IN");
    expect(result.text).toBe("Accept charging");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ text: "Accept charging", language_code: "en-IN" });
  });

  it("rejects unsupported languages before making a provider request", async () => {
    process.env.SARVAM_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(sarvamTranslate("Hello", "xx-IN")).rejects.toThrow("Unsupported language");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
