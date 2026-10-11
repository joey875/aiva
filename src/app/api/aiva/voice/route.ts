import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getVoiceContext } from "@/lib/aiva/context";
import { anthropic, AIVA_MODEL } from "@/lib/aiva/anthropic-client";
import { AIVA_TOOLS, runAivaTool } from "@/lib/aiva/tools";
import { synthesizeSpeechStream, transcribeAudio } from "@/lib/aiva/elevenlabs";
import { TZ } from "@/lib/time";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOOL_LOOPS = 6;
const MAX_HISTORY_TURNS = 8;

type HistoryTurn = { role: "user" | "assistant"; text: string };

function systemPrompt(repName: string): string {
  const now = new Date();
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return [
    `You are Aiva (pronounced "Ava"), a warm, upbeat, concise sales assistant speaking out loud to ${repName || "a rep"}.`,
    "Keep every reply short and spoken-style: one to three sentences, plain natural speech. Never use lists, markdown, or headers - say it the way a person would say it out loud.",
    `Right now it is ${when} in America/Chicago. Interpret any relative dates or times ("tomorrow", "Monday", "in an hour") against that.`,
    "You have tools to check the rep's schedule, search and look up customers, check the pipeline, log notes, and set reminders - each one only returns or changes data this rep is allowed to see.",
    'Before calling add_note or create_reminder, say out loud exactly what you are about to save (and when, for a reminder) and ask the rep to confirm - for example, "Add a note to Jones: wants pricing - save it?" Only call that tool on a later turn, and only once the rep clearly says yes (yes, yeah, sure, do it, go ahead). If they say no or cancel, drop it, acknowledge, and move on - never call the tool.',
    "Never ask for confirmation before read-only tools (schedule, search, customer lookup, pipeline summary) - just answer naturally.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const ctx = await getVoiceContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "Missing audio." }, { status: 400 });

  let history: HistoryTurn[] = [];
  const historyRaw = form.get("history");
  if (typeof historyRaw === "string") {
    try {
      const parsed = JSON.parse(historyRaw);
      if (Array.isArray(parsed)) {
        history = parsed
          .filter((t): t is HistoryTurn => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
          .slice(-MAX_HISTORY_TURNS);
      }
    } catch {
      // Ignore a malformed history payload and carry on without it.
    }
  }

  let transcript: string;
  try {
    transcript = await transcribeAudio(audio);
  } catch (err) {
    console.error("Aiva STT error", err);
    return NextResponse.json({ error: "Transcription failed." }, { status: 502 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "no_speech", transcript: "" }, { status: 422 });
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.text }) as Anthropic.MessageParam),
    { role: "user", content: transcript },
  ];

  let reply = "Sorry, I'm having trouble right now.";
  try {
    const system = systemPrompt(ctx.profile.full_name);
    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const response = await anthropic.messages.create({
        model: AIVA_MODEL,
        max_tokens: 1024,
        thinking: { type: "disabled" },
        system,
        tools: AIVA_TOOLS,
        messages,
      });

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      if (text) reply = text;

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        let result: unknown;
        try {
          result = await runAivaTool(use.name, (use.input as Record<string, unknown>) ?? {}, ctx);
        } catch (err) {
          console.error("Aiva tool error", use.name, err);
          result = { error: "That tool failed unexpectedly." };
        }
        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    console.error("Aiva Claude error", err);
    return NextResponse.json({ error: "Assistant failed." }, { status: 502 });
  }

  let audioStream: ReadableStream<Uint8Array>;
  try {
    audioStream = await synthesizeSpeechStream(reply);
  } catch (err) {
    console.error("Aiva TTS error", err);
    return NextResponse.json({ error: "Speech synthesis failed.", transcript, reply }, { status: 502 });
  }

  return new NextResponse(audioStream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Aiva-Transcript": encodeURIComponent(transcript),
      "X-Aiva-Reply": encodeURIComponent(reply),
    },
  });
}
