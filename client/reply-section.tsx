import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View, type PressableStateCallbackType } from "react-native";
import { useComposers } from "@getpaseo/plugin/client";
import { Icon, useToast } from "@getpaseo/plugin/client/ui";
import type { ComposerSectionProps } from "./composer-section-api";
import type { Replies } from "./replies";

type RowState = PressableStateCallbackType & { hovered?: boolean };

export function ReplySection({
  replies,
  agentId,
  theme,
  layout,
}: ComposerSectionProps & { replies: Replies }) {
  const state = useSyncExternalStore(
    replies.subscribe,
    () => replies.snapshot(agentId),
    () => null,
  );
  const [composer] = useComposers({ agentId });
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const prompt = composer?.prompt ?? "";
  useEffect(() => {
    if (prompt.trim()) replies.dismiss(agentId);
  }, [replies, agentId, prompt]);
  if (!composer || prompt.trim() || !state) return null;
  const color = theme.colors.foreground;
  const muted = theme.colors.foregroundMuted;
  return (
    <View style={{ paddingHorizontal: 6, paddingBottom: 6, gap: 2 }}>
      <Text style={{ color: muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 6 }}>
        Suggested replies
      </Text>
      {state.status === "error" ? (
        <View style={{ paddingHorizontal: 6, gap: 4 }}>
          <Text accessibilityRole="alert" style={{ color: muted, fontSize: 12 }}>
            {state.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={async () => {
              setPending(true);
              try {
                await replies.retry(agentId);
              } finally {
                setPending(false);
              }
            }}
          >
            <Text style={{ color, fontSize: 13 }}>
              {pending ? "Retrying…" : "Retry suggestions"}
            </Text>
          </Pressable>
        </View>
      ) : (
        state.replies.map((reply) => (
          <Pressable
            key={reply}
            accessibilityRole="button"
            accessibilityLabel={`Insert draft: ${reply}`}
            disabled={pending}
            onPress={async () => {
              setPending(true);
              try {
                await replies.accept(agentId, reply);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not insert reply.");
              } finally {
                setPending(false);
              }
            }}
            style={(row: RowState) => ({
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 6,
              paddingHorizontal: 6,
              paddingVertical: layout.compact ? 7 : 3,
              borderRadius: 4,
              backgroundColor: row.pressed || row.hovered ? theme.colors.surface2 : "transparent",
            })}
          >
            <View style={{ height: 18, justifyContent: "center" }}>
              <Icon name="CornerDownRight" size={12} color={muted} />
            </View>
            <Text style={{ color, fontSize: 13, lineHeight: 18, flexShrink: 1 }}>{reply}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
