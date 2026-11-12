import type { ComponentType } from "react";
import type { PluginHostProps } from "@getpaseo/plugin/client";
import type { PluginCleanup } from "@getpaseo/plugin";

// Prototype declaration for getpaseo/paseo#9520; remove when its SDK is published.
export interface ComposerSectionProps extends PluginHostProps {
  agentId: string;
  workspaceId: string;
}

declare module "@getpaseo/plugin/client" {
  interface PluginClientContext {
    addComposerSection(contribution: {
      id: string;
      Component: ComponentType<ComposerSectionProps>;
    }): PluginCleanup;
  }
}
