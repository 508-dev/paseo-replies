# Replies prototype

A 508-dev fork of cleiter/paseo-replies, Apache-2.0. Keep LICENSE and attribution.

Client code stays under client/, daemon code under server/, pure contracts under shared/. No DOM APIs. Every text color comes from theme.colors.

This branch uses the proposed addComposerSection API from the accompanying core PR. Published 0.16.0-beta.2 clients lack it. Keep the explicit runtime refusal and temporary type declaration until the API ships. Inline suggestions have no pill or dismiss button. Hide on selection, typing, or a new turn without resurrecting cleared suggestions. Suggestions insert an editable draft; they must never send automatically or overwrite a nonempty prompt.

Generation uses a configurable Claude CLI model, no tools/MCP/settings/hooks or saved session, in a temporary directory. Do not weaken that isolation. Do not generate for old idle agents on startup.

After changes run npm run typecheck, npm run lint, the specific affected Vitest files, and npm run format. Commit only task changes. Runtime ID: replies-508. Do not restart the main daemon.
