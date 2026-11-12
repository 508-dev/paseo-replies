import type { PluginServerContext } from "@getpaseo/plugin/server";
import { suggestReplies } from "./server/suggestions";
import { suggestRepliesRpc } from "./shared/suggestions";
import { preferences } from "./shared/preferences";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  server.handle(suggestRepliesRpc, async (input) => {
    const state = await settings.read();
    if (state.status !== "ready") throw new Error(state.error);
    return suggestReplies(input, state.values);
  });
  return () => {};
}
