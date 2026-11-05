import type { PluginClientContext } from "@getpaseo/plugin/client";
import { observeAgents } from "./client/agents";
import { contributeReplyPills } from "./client/reply-pills";

export default function contribute(client: PluginClientContext) {
  const agents = observeAgents(client);
  const stopReplies = contributeReplyPills(client, agents);
  return () => {
    stopReplies();
    agents.stop();
  };
}
