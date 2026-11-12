import type { PluginComposer } from "@getpaseo/plugin/client";

export async function insertReply(
  composer: Pick<PluginComposer, "prompt" | "setPrompt" | "focus"> | undefined,
  text: string,
): Promise<void> {
  if (!composer) throw new Error("This agent's composer is unavailable.");
  if (composer.prompt.trim())
    throw new Error("Clear your draft before inserting a suggested reply.");
  composer.setPrompt(text);
  await composer.focus({ selection: { start: text.length, end: text.length } });
}
