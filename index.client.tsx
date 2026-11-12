import type { PluginClientContext } from "@getpaseo/plugin/client";
import { GenerationSettings } from "./client/generation-settings";
import { observeAgents } from "./client/agents";
import { contributeReplyPills } from "./client/reply-pills";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({
    id: "generation",
    title: "Generation",
    icon: "Settings",
    Component: GenerationSettings,
  });
  const agents = observeAgents(client);
  const stopReplies = contributeReplyPills(client, agents);
  return () => {
    stopReplies();
    agents.stop();
  };
}
