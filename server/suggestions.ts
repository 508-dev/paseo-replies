import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import {
  parseReplies,
  SUGGESTION_SYSTEM_PROMPT,
  suggestionPrompt,
  type suggestRepliesRpc,
} from "../shared/suggestions";

import type { GenerationOptions } from "../shared/preferences";

const TIMEOUT_MS = 30_000;
/** Answers per message, so a reconnecting app does not ask again. */
const CACHE_SIZE = 100;
const cache = new Map<string, string[]>();
const pending = new Map<string, Promise<string>>();

function findClaude(executable: string): string {
  if (executable !== "claude") return executable;
  // The desktop app's PATH is not the login shell's; the installer puts claude in ~/.local/bin.
  const dirs = [
    ...(process.env.PATH ?? "").split(delimiter),
    join(homedir(), ".local/bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  for (const dir of dirs) {
    const candidate = join(dir, "claude");
    if (dir && existsSync(candidate)) return candidate;
  }
  throw new Error("claude was not found on PATH");
}

/**
 * One isolated Claude call through the user's own claude login: no tools, MCP
 * servers, skills, settings or hooks, no saved session, and a working directory
 * without a project, so the message is the only context.
 */
export async function suggestReplies(
  { message, userMessage }: RpcInput<typeof suggestRepliesRpc>,
  options: GenerationOptions,
): Promise<RpcOutput<typeof suggestRepliesRpc>> {
  if (!options.enabled) return { replies: [] };
  const prompt = suggestionPrompt(message, userMessage);
  const key = JSON.stringify([options.model, options.executable, prompt]);
  const cached = cache.get(key);
  if (cached) return { replies: cached };
  const args = [
    "-p",
    "--model",
    options.model,
    "--tools",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--system-prompt",
    SUGGESTION_SYSTEM_PROMPT,
    prompt,
  ];
  let request = pending.get(key);
  if (!request) {
    if (pending.size >= 4) throw new Error("Reply generation is busy. Try again shortly.");
    request = new Promise<string>((resolve, reject) => {
      execFile(
        findClaude(options.executable),
        args,
        { cwd: tmpdir(), timeout: TIMEOUT_MS },
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr.trim() || error.message));
          else resolve(stdout);
        },
      );
    });
    pending.set(key, request);
  }
  let output: string;
  try {
    output = await request;
  } finally {
    pending.delete(key);
  }
  const replies = parseReplies(output);
  cache.set(key, replies);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  return { replies };
}
