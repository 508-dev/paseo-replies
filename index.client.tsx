import type { PluginClientContext } from "@getpaseo/plugin/client";
import { GenerationSettings } from "./client/generation-settings";
import { observeAgents } from "./client/agents";
import { createReplies } from "./client/replies";
import { ReplySection } from "./client/reply-section";
import type { ComposerSectionProps } from "./client/composer-section-api";
import { lastExchange, suggestRepliesRpc } from "./shared/suggestions";

export default function contribute(client: PluginClientContext) {
  if (typeof client.addComposerSection !== "function") {
    throw new Error(
      "This prototype needs Paseo built with the composer section API. See the repository README.",
    );
  }
  client.addSettingsScreen({
    id: "generation",
    title: "Generation",
    icon: "Settings",
    Component: GenerationSettings,
  });
  const agents = observeAgents(client);
  const replies = createReplies({
    agents,
    composer(agentId) {
      return client.composers({ agentId })[0];
    },
    async readExchange(agentId) {
      const { entries } = await client.paseo.agents
        .ref(agentId)
        .timeline.refetch({ direction: "tail", limit: 30 });
      const exchange = lastExchange(
        entries.map(({ item }) => ({
          type: item.type,
          text: "text" in item && typeof item.text === "string" ? item.text : undefined,
        })),
      );
      return exchange.message
        ? { message: exchange.message, userMessage: exchange.userMessage }
        : null;
    },
    generate(input) {
      return client.rpc(suggestRepliesRpc, input);
    },
  });
  function Suggestions(props: ComposerSectionProps) {
    return <ReplySection {...props} replies={replies} />;
  }
  const remove = client.addComposerSection({ id: "suggested-replies", Component: Suggestions });
  return () => {
    remove();
    replies.stop();
    agents.stop();
  };
}
