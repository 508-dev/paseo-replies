import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const preferences = defineSettings({
  id: "generation",
  scope: "host",
  version: 1,
  schema: z.object({
    enabled: z.boolean().default(true),
    model: z.string().trim().min(1).max(200).default("haiku"),
    executable: z.string().trim().min(1).max(1024).default("claude"),
  }),
});
export type GenerationOptions = z.infer<typeof preferences.schema>;
