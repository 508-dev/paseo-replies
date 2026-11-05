import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** The tail of a long message is what the reply answers. */
export const MESSAGE_LIMIT = 4000;
/** Enough of the user's own message to tell its language. */
export const USER_MESSAGE_LIMIT = 500;
const MAX_REPLIES = 3;
const MAX_REPLY_LENGTH = 80;

/** Up to three replies the user would likely send after the agent's last message, from Haiku. */
export const suggestRepliesRpc = defineRpc({
  name: "suggestions.replies",
  input: z.object({
    message: z.string().min(1).max(MESSAGE_LIMIT),
    /** The user's message that started the turn: the replies are written in its language. */
    userMessage: z.string().max(USER_MESSAGE_LIMIT).nullable(),
  }),
  output: z.object({ replies: z.array(z.string()) }),
});

export const SUGGESTION_SYSTEM_PROMPT = [
  "You suggest what the user will most likely reply next to a coding agent.",
  "You get the user's previous message, when there is one, and the agent's last message.",
  "Answer with only a JSON array of short replies (at most 6 words each), most likely first.",
  "Give one reply per distinct choice the message offers the user, and at most 3.",
  "Replies must be semantically distinct: each one leads the agent to do something different. Never reword one reply as another, as \"Do X\" and \"Yes, do X\" would.",
  "A yes or no question gets one or two replies: agree, and decline or the alternative it names. A message that only reports something gets at most one obvious next step, or [].",
  "Never pad with generic replies such as thanks, looks good or show me the diff.",
  "Write them in the language of the user's previous message; without one, in the main language of the agent's message, ignoring quoted text.",
  "Answer [] when no reply is natural.",
].join(" ");

/** What Haiku reads: the user's message, so it can tell the language, then the agent's. */
export function suggestionPrompt(message: string, userMessage: string | null): string {
  return userMessage ? `User's previous message:\n${userMessage}\n\nAgent's last message:\n${message}` : `Agent's last message:\n${message}`;
}

/**
 * The agent's last message in its last turn, cut to its tail, and the user's
 * message that started that turn, cut to its start; `message` is null when the
 * turn has no agent message.
 */
export function lastExchange(items: ReadonlyArray<{ readonly type: string; readonly text?: string }>): {
  message: string | null;
  userMessage: string | null;
} {
  let message: string | null = null;
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    const text = item.text?.trim();
    if (item.type === "user_message") return { message, userMessage: text ? text.slice(0, USER_MESSAGE_LIMIT) : null };
    if (item.type === "assistant_message" && text && message === null) message = text.slice(-MESSAGE_LIMIT);
  }
  return { message, userMessage: null };
}

/** Agreement words that do not change what a reply asks for: "Yes, do X" is "Do X". */
const LEADING_AGREEMENT = /^(?:(?:yes|yeah|yep|sure|ok|okay|please|ja|jo|gerne|bitte)\b\s*)+/;

/** What a reply asks for: lowercase, without punctuation or leading agreement, so near-copies compare equal. */
function replyKey(reply: string): string {
  const words = reply.toLowerCase().replace(/[^\p{L}\p{N}#]+/gu, " ").trim();
  return words.replace(LEADING_AGREEMENT, "").trim() || words;
}

/** The end of the bracketed text opening at `start`, skipping brackets inside JSON strings, or -1. */
function closingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return i;
  }
  return -1;
}

/** The first JSON array in the model's answer, which may surround it with prose or a code fence. */
function firstArray(output: string): unknown[] | null {
  for (let start = output.indexOf("["); start !== -1; start = output.indexOf("[", start + 1)) {
    const end = closingBracket(output, start);
    if (end === -1) continue;
    try {
      const parsed: unknown = JSON.parse(output.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Brackets in prose: try the next one.
    }
  }
  return null;
}

/** The replies in the model's answer: the first JSON array of strings, cleaned. Anything else gives none. */
export function parseReplies(output: string): string[] {
  const parsed = firstArray(output);
  if (!parsed) return [];
  const seen = new Set<string>();
  const replies: string[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "string") continue;
    const reply = entry.trim();
    const key = replyKey(reply);
    if (!reply || reply.length > MAX_REPLY_LENGTH || seen.has(key)) continue;
    seen.add(key);
    replies.push(reply);
    if (replies.length === MAX_REPLIES) break;
  }
  return replies;
}
