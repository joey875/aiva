import "server-only";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const TTS_MODEL = "eleven_turbo_v2_5"; // ElevenLabs' current low-latency multilingual/turbo model

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

/** Transcribe recorded audio with ElevenLabs Scribe (speech-to-text), English. */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "audio");
  form.append("model_id", "scribe_v1");
  form.append("language_code", "en");

  const res = await fetch(`${ELEVEN_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });
  if (!res.ok) throw new Error(`ElevenLabs STT failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

/** Synthesize speech with ElevenLabs TTS, streamed. Caller forwards the stream to the client. */
export async function synthesizeSpeechStream(text: string): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`ElevenLabs TTS failed (${res.status}): ${await res.text()}`);
  return res.body;
}
