import type { PluginClientContext } from "@getpaseo/plugin/client";

// The plugin typechecks without the DOM library. Declare only what this module uses.
declare const console: { error(...data: unknown[]): void };

export interface AgentListener {
  /** Every agent may have changed: after the first snapshot and after a reconnect. */
  reset(): void;
  changed(agentId: string): void;
}

export interface Agents {
  /** Each agent's workspace; an agent without one has no composer to show a pill in. */
  readonly workspaces: ReadonlyMap<string, string>;
  /** The latest status each agent reported: `running` while a turn is under way. */
  readonly statuses: ReadonlyMap<string, string>;
  /** Agents that have ever been seen, including ones since removed, for cleanup. */
  ids(): Iterable<string>;
  listen(listener: AgentListener): () => void;
  stop(): void;
}

/** One subscription to the host's agents. It delivers a snapshot, then updates, and a fresh snapshot after a reconnect. */
export function observeAgents(client: PluginClientContext): Agents {
  let stopped = false;
  let release: (() => Promise<void>) | null = null;
  const workspaces = new Map<string, string>();
  const statuses = new Map<string, string>();
  const seen = new Set<string>();
  const listeners = new Set<AgentListener>();
  const emit = (notify: (listener: AgentListener) => void) => {
    if (stopped) return;
    for (const listener of listeners) notify(listener);
  };
  const set = (agent: { id: string; workspaceId?: string | null; status: string }) => {
    seen.add(agent.id);
    statuses.set(agent.id, agent.status);
    if (agent.workspaceId) workspaces.set(agent.id, agent.workspaceId);
    else workspaces.delete(agent.id);
  };

  void client.paseo.agents
    .list({ subscribe: {} })
    .then(({ subscription }) => {
      if (stopped) return void subscription.release();
      release = () => subscription.release();
      subscription.subscribe({
        snapshot: ({ entries }) => {
          workspaces.clear();
          statuses.clear();
          for (const { agent } of entries) set(agent);
          emit((listener) => listener.reset());
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          const id = update.kind === "remove" ? update.agentId : update.agent.id;
          if (update.kind === "remove") {
            workspaces.delete(id);
            statuses.delete(id);
          } else set(update.agent);
          emit((listener) => listener.changed(id));
        },
      });
      return undefined;
    })
    .catch((error: unknown) => {
      if (!stopped) console.error("Agent observation failed", error);
    });

  return {
    workspaces,
    statuses,
    ids: () => seen,
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      stopped = true;
      listeners.clear();
      void release?.();
    },
  };
}
