import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import { parseReplies, SUGGESTION_SYSTEM_PROMPT, suggestionPrompt, type suggestRepliesRpc } from "../shared/suggestions";

const TIMEOUT_MS = 30_000;
const MODEL = "haiku";
/** Answers per message, so a reconnecting app does not ask again. */
const CACHE_SIZE = 100;
const cache = new Map<string, string[]>();

function findClaude(): string {
  // The desktop app's PATH is not the login shell's; the installer puts claude in ~/.local/bin.
  const dirs = [...(process.env.PATH ?? "").split(delimiter), join(homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  for (const dir of dirs) {
    const candidate = join(dir, "claude");
    if (dir && existsSync(candidate)) return candidate;
  }
  throw new Error("claude was not found on PATH");
}

/**
 * One isolated Haiku call through the user's own claude login: no tools, MCP
 * servers, skills, settings or hooks, no saved session, and a working directory
 * without a project, so the message is the only context.
 */
export async function suggestReplies({
  message,
  userMessage,
}: RpcInput<typeof suggestRepliesRpc>): Promise<RpcOutput<typeof suggestRepliesRpc>> {
  const prompt = suggestionPrompt(message, userMessage);
  const cached = cache.get(prompt);
  if (cached) return { replies: cached };
  const args = [
    "-p",
    "--model",
    MODEL,
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
  const output = await new Promise<string>((resolve, reject) => {
    execFile(findClaude(), args, { cwd: tmpdir(), timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout);
    });
  });
  const replies = parseReplies(output);
  cache.set(prompt, replies);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return { replies };
}
