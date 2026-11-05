import type { PluginServerContext } from "@getpaseo/plugin/server";
import { suggestReplies } from "./server/suggestions";
import { suggestRepliesRpc } from "./shared/suggestions";

export default function contribute(server: PluginServerContext) {
  server.handle(suggestRepliesRpc, suggestReplies);
  return () => {};
}
