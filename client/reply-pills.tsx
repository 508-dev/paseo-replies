import {
  type PluginButtonContentProps,
  type PluginButtonRegistration,
  type PluginClientContext,
  useAgent,
} from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, type PressableStateCallbackType, Text, View } from "react-native";
import { lastExchange, suggestRepliesRpc } from "../shared/suggestions";
import type { Agents } from "./agents";

// The plugin typechecks without the DOM library. Declare only what this module uses.
declare const console: { error(...data: unknown[]): void };

const BUSY = new Set(["running", "initializing"]);
/** Timeline entries read at a turn's end; the agent's last message sits at the tail. */
const TAIL = 30;

// React Native Web adds `hovered` to the pressable state; native never sets it.
type RowState = PressableStateCallbackType & { hovered?: boolean };

interface AgentPills {
  readonly workspaceId: string;
  readonly replies: { readonly count: number; readonly registration: PluginButtonRegistration } | null;
}

/**
 * For every agent with a workspace, after each turn: a Replies pill whose popover
 * lists the answers Haiku suggests for the agent's last message. Choosing one
 * sends it as is; the pill is hidden while the agent runs a turn.
 */
export function contributeReplyPills(client: PluginClientContext, agents: Agents) {
  let stopped = false;
  const replies = new Map<string, readonly string[]>();
  const listeners = new Set<() => void>();
  const statuses = new Map<string, string | undefined>();
  // Only the latest read per agent may land: a new turn can end before an older read returns.
  const reads = new Map<string, number>();
  const pills = new Map<string, AgentPills>();

  const setReplies = (agentId: string, list: readonly string[] | null) => {
    if (list) replies.set(agentId, list);
    else replies.delete(agentId);
    for (const listener of listeners) listener();
  };

  const send = (agentId: string, text: string) => {
    setReplies(agentId, null);
    render(agentId);
    return client.paseo.agents
      .ref(agentId)
      .send(text)
      .catch((error: unknown) => console.error(`Sending "${text}" failed`, error));
  };

  // The popover reads the list live, so a new list never needs a new behavior,
  // which would close an open popover.
  function RepliesMenu({ theme, close, ...target }: PluginButtonContentProps) {
    const agentId = target.context === "agent" ? target.agentId : "";
    const [list, setList] = useState(() => replies.get(agentId) ?? []);
    useEffect(() => {
      const listener = () => setList(replies.get(agentId) ?? []);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    }, [agentId]);
    const busy = useAgent(agentId, (agent) => BUSY.has(agent.status)) === true;
    const styles = useMemo(
      () => ({
        // A fixed width: a long reply wraps instead of widening the popover.
        list: { gap: 2, width: 340 },
        row: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 6 },
        icon: { flexShrink: 0, height: 20, justifyContent: "center" as const, marginTop: 2 },
        highlighted: { backgroundColor: theme.colors.surface2 },
        text: { flex: 1, color: theme.colors.foreground, fontSize: 14, lineHeight: 20 },
        note: { color: theme.colors.foregroundMuted, fontSize: 12, paddingHorizontal: 10, paddingVertical: 4 },
      }),
      [theme],
    );
    return (
      <View style={styles.list}>
        {busy ? <Text style={styles.note}>Available when the agent finishes its turn.</Text> : null}
        {list.map((reply) => (
          <Pressable
            key={reply}
            accessibilityRole="button"
            accessibilityLabel={`Send: ${reply}`}
            disabled={busy}
            onPress={() => {
              close();
              void send(agentId, reply);
            }}
            style={(state: RowState) => [
              styles.row,
              (state.pressed || state.hovered) && !busy ? styles.highlighted : null,
              busy ? { opacity: 0.5 } : null,
            ]}
          >
            <View style={styles.icon}>
              <Icon name="MessageSquareReply" size={16} color={theme.colors.foreground} />
            </View>
            <Text style={styles.text}>{reply}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  const remove = (agentId: string) => {
    pills.get(agentId)?.replies?.registration.remove();
    pills.delete(agentId);
  };

  const repliesPill = (workspaceId: string, agentId: string, count: number) => ({
    count,
    registration: client.addComposerPill({
      id: "replies",
      workspaceId,
      agentId,
      button: {
        title: "Send a reply Haiku suggests for the agent's last message",
        icon: "MessageSquareReply",
        label: `Replies · ${count}`,
        behavior: { kind: "popover", Content: RepliesMenu },
      },
    }),
  });

  function render(agentId: string) {
    if (stopped) return;
    const workspaceId = agents.workspaces.get(agentId);
    if (!workspaceId) return remove(agentId);
    const busy = BUSY.has(agents.statuses.get(agentId) ?? "");
    const count = busy ? 0 : (replies.get(agentId)?.length ?? 0);
    let pill = pills.get(agentId);
    if (pill && pill.workspaceId !== workspaceId) {
      remove(agentId);
      pill = undefined;
    }
    if (!pill) {
      pills.set(agentId, { workspaceId, replies: count > 0 ? repliesPill(workspaceId, agentId, count) : null });
      return;
    }
    let next = pill.replies;
    if (count === 0) {
      next?.registration.remove();
      next = null;
    } else if (!next) next = repliesPill(workspaceId, agentId, count);
    else if (next.count !== count) {
      next.registration.update({ label: `Replies · ${count}` });
      next = { ...next, count };
    }
    pills.set(agentId, { ...pill, replies: next });
  }

  const suggest = async (agentId: string) => {
    const read = (reads.get(agentId) ?? 0) + 1;
    reads.set(agentId, read);
    const { entries } = await client.paseo.agents.ref(agentId).timeline.refetch({ direction: "tail", limit: TAIL });
    const { message, userMessage } = lastExchange(
      entries.map(({ item }) => ({ type: item.type, text: "text" in item && typeof item.text === "string" ? item.text : undefined })),
    );
    const { replies: suggested } = message ? await client.rpc(suggestRepliesRpc, { message, userMessage }) : { replies: [] };
    if (stopped || reads.get(agentId) !== read) return;
    setReplies(agentId, suggested);
    render(agentId);
  };

  /** A turn ends when the agent leaves running or initializing; a new one makes the old replies stale. */
  const agentChanged = (agentId: string) => {
    const previous = statuses.get(agentId);
    const status = agents.statuses.get(agentId);
    statuses.set(agentId, status);
    const wasBusy = previous !== undefined && BUSY.has(previous);
    const isBusy = status !== undefined && BUSY.has(status);
    if (isBusy && !wasBusy) {
      setReplies(agentId, null);
      reads.set(agentId, (reads.get(agentId) ?? 0) + 1);
    }
    if (wasBusy && !isBusy && agents.workspaces.has(agentId))
      suggest(agentId).catch((error: unknown) => {
        if (!stopped) console.error(`Suggesting replies for agent ${agentId} failed`, error);
      });
    render(agentId);
  };

  const stopListening = agents.listen({
    // No suggestions for turns that ended before the app opened: that would ask Haiku for every idle agent.
    // After a reconnect, a turn may have ended unseen, so the replies held and any read under way are stale.
    reset() {
      for (const agentId of new Set([...agents.ids(), ...pills.keys()])) {
        statuses.set(agentId, agents.statuses.get(agentId));
        reads.set(agentId, (reads.get(agentId) ?? 0) + 1);
        setReplies(agentId, null);
        render(agentId);
      }
    },
    changed: agentChanged,
  });

  return () => {
    stopped = true;
    stopListening();
    listeners.clear();
    for (const agentId of [...pills.keys()]) remove(agentId);
  };
}
