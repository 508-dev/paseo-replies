import { useState } from "react";
import { Text } from "react-native";
import { useSettings, type PluginSurfaceProps, type SettingsState } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { preferences } from "../shared/preferences";

type ReadySettings = Extract<SettingsState<typeof preferences.schema>, { status: "ready" }>;

function Editor({ settings }: { settings: ReadySettings }) {
  const [draft, setDraft] = useState(() => ({
    values: settings.values,
    revision: settings.revision,
  }));
  return (
    <SettingsSection title="Reply generation">
      <SettingsCard>
        <SettingsSwitch
          label="Generate after each turn"
          value={draft.values.enabled}
          disabled={settings.saving}
          onValueChange={(enabled) => setDraft({ ...draft, values: { ...draft.values, enabled } })}
        />
        <SettingsInput
          label="Claude model"
          hint="A Claude CLI model alias or full model ID. Independent of the conversation model."
          initialValue={draft.values.model}
          disabled={settings.saving}
          onChangeText={(model) => setDraft({ ...draft, values: { ...draft.values, model } })}
        />
        <SettingsInput
          label="Claude executable"
          hint="Executable name or absolute path on the daemon host. Arguments are never interpreted by a shell."
          initialValue={draft.values.executable}
          disabled={settings.saving}
          onChangeText={(executable) =>
            setDraft({ ...draft, values: { ...draft.values, executable } })
          }
        />
        <SettingsAction
          label="Save generation settings"
          actionLabel="Save"
          disabled={settings.saving}
          error={settings.saveError}
          onPress={async () => {
            await settings.save(draft.values, draft.revision);
          }}
        />
      </SettingsCard>
    </SettingsSection>
  );
}

export function GenerationSettings({ theme }: PluginSurfaceProps) {
  const settings = useSettings(preferences);
  if (settings.status === "ready") return <Editor key={settings.revision} settings={settings} />;
  if (settings.status === "loading")
    return <Text style={{ color: theme.colors.foreground }}>Loading settings…</Text>;
  return (
    <SettingsSection title="Reply generation">
      <Text accessibilityRole="alert" style={{ color: theme.colors.foreground }}>
        {settings.error}
      </Text>
      <SettingsAction label="Read settings again" actionLabel="Retry" onPress={settings.reload} />
      {settings.status === "invalid" ? (
        <SettingsAction label="Restore defaults" actionLabel="Reset" onPress={settings.reset} />
      ) : null}
    </SettingsSection>
  );
}
