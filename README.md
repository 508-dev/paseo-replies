# Replies for Paseo

A 508-dev prototype of suggested next replies. After an agent finishes, a **Replies** pill offers up to three choices. Selecting one fills the empty composer and focuses it so you can edit, then send normally. It never sends a suggestion automatically or replaces an existing draft.

Requires **both the app and daemon on Paseo 0.16.0-beta.2 or later**. The stable 0.15 SDK does not include the composer APIs this prototype uses.

```sh
paseo plugin install git:508-dev/paseo-replies
```

Plugins must already be enabled under Settings → Plugins. Plugins are trusted, unsandboxed code on the daemon host and in the app.

## Generation settings

Open this plugin's settings under Settings → Plugins:

- **Generate after each turn:** turn future generation on or off. Suggestions already displayed remain until the next turn or plugin reload.
- **Claude model:** defaults to `haiku`. Set a Claude CLI model alias or full model ID, independently of the conversation's provider and model.
- **Claude executable:** defaults to `claude`; alternatively set an executable name or absolute path on the daemon host. Log in to that CLI first. A wrapper must implement the Claude CLI arguments. Arbitrary provider APIs are not supported in this prototype.

Settings apply to future requests and are shared by clients of this host. Existing cached replies are keyed by model, executable, and input; duplicate in-flight requests are shared. At most four different requests run concurrently. Failures show a retry action in the pill.

The last assistant message (up to 4,000 characters) and preceding user message (up to 500 characters) go through the configured Claude CLI to its model provider. No tools, MCP servers, project settings, hooks, or saved sessions are enabled for that call. Opening the app does not generate replies for old turns. Each request has a 30-second timeout.

## Prototype limits

Suggestions appear in a pill/popover, not as inline ghost text. Tab-to-accept, arrow-key selection in the composer, automatic suggestion placement, and shared Escape dismissal need a host-owned composer suggestions API. The app's existing popover dismissal still works. Mobile uses the host's compact presentation.

Generation follows agent status transitions observed by an open client. A disconnected client can miss a completed turn. Multiple clients share identical in-flight generation but do not share suggestion UI state. Disabling generation does not cancel a request already running.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm exec -- vitest run test/suggestions.test.ts test/insert-reply.test.ts test/generation.test.ts --bail=1
npm run format
paseo plugin reload replies-508
```

Paseo supplies runtime dependencies; installing from Git requires no preparation commands.

Core API proposal: [composer suggestions and Tab-to-accept](https://github.com/getpaseo/paseo/discussions/9516).

## Attribution

Derived from [cleiter/paseo-replies](https://github.com/cleiter/paseo-replies), commit `aab1c77`, under Apache-2.0. Original history and LICENSE are retained. 508-dev changed reply acceptance to editable drafts and added model configuration, visible errors, request deduplication, and regression tests. This fork is an independent prototype.
