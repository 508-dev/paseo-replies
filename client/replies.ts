import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginComposer } from "@getpaseo/plugin/client";
import type { suggestRepliesRpc } from "../shared/suggestions";
import type { Agents } from "./agents";
import { insertReply } from "./insert-reply";

export type ReplyState =
  | { status: "ready"; replies: readonly string[] }
  | { status: "error"; message: string }
  | null;
export interface ReplyDependencies {
  agents: Agents;
  readExchange(agentId: string): Promise<RpcInput<typeof suggestRepliesRpc> | null>;
  generate(input: RpcInput<typeof suggestRepliesRpc>): Promise<RpcOutput<typeof suggestRepliesRpc>>;
  composer(agentId: string): Pick<PluginComposer, "prompt" | "setPrompt" | "focus"> | undefined;
}
const BUSY = new Set(["running", "initializing"]);

export function createReplies({ agents, readExchange, generate, composer }: ReplyDependencies) {
  const states = new Map<string, ReplyState>();
  const reads = new Map<string, number>();
  const statuses = new Map<string, string | undefined>();
  const listeners = new Set<() => void>();
  let stopped = false;
  function publish(agentId: string, state: ReplyState) {
    if (state === null) states.delete(agentId);
    else states.set(agentId, state);
    for (const listener of listeners) listener();
  }
  function dismiss(agentId: string) {
    reads.set(agentId, (reads.get(agentId) ?? 0) + 1);
    publish(agentId, null);
  }
  function isBusy(agentId: string) {
    return BUSY.has(agents.statuses.get(agentId) ?? "");
  }
  async function retry(agentId: string) {
    if (stopped || isBusy(agentId) || composer(agentId)?.prompt.trim()) return;
    const read = (reads.get(agentId) ?? 0) + 1;
    reads.set(agentId, read);
    try {
      const input = await readExchange(agentId);
      if (stopped || reads.get(agentId) !== read) return;
      const result = input ? await generate(input) : { replies: [] };
      if (stopped || reads.get(agentId) !== read) return;
      if (composer(agentId)?.prompt.trim()) return dismiss(agentId);
      const state: ReplyState = result.replies.length
        ? { status: "ready", replies: result.replies }
        : null;
      publish(agentId, state);
    } catch (error) {
      if (stopped || reads.get(agentId) !== read) return;
      publish(agentId, {
        status: "error",
        message: error instanceof Error ? error.message : "Could not generate replies.",
      });
    }
  }
  const release = agents.listen({
    reset() {
      for (const agentId of new Set([...agents.ids(), ...states.keys()])) {
        statuses.set(agentId, agents.statuses.get(agentId));
        dismiss(agentId);
      }
    },
    changed(agentId) {
      const previous = statuses.get(agentId);
      const current = agents.statuses.get(agentId);
      statuses.set(agentId, current);
      if (isBusy(agentId) || !agents.workspaces.has(agentId)) return dismiss(agentId);
      if (previous !== undefined && BUSY.has(previous)) void retry(agentId);
    },
  });
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot(agentId: string): ReplyState {
      return states.get(agentId) ?? null;
    },
    dismiss,
    retry,
    async accept(agentId: string, text: string) {
      const state = states.get(agentId);
      const current = state?.status === "ready" && state.replies.includes(text);
      if (stopped || isBusy(agentId) || !current)
        throw new Error("This suggestion is no longer current.");
      const target = composer(agentId);
      // insertReply writes synchronously before awaiting focus. Publish the cleared state immediately.
      const inserted = insertReply(target, text);
      dismiss(agentId);
      await inserted;
    },
    stop() {
      stopped = true;
      release();
      states.clear();
      reads.clear();
      listeners.clear();
    },
  };
}
export type Replies = ReturnType<typeof createReplies>;
