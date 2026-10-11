import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Correct current Sonnet 5 model id (the brief said "claude-sonnet-5-5", which
// isn't a real model id - "claude-sonnet-5" is what the API actually serves).
export const AIVA_MODEL = "claude-sonnet-5";
