# paseo-replies — agent instructions

A [Paseo](https://paseo.sh) plugin: after each agent turn, a Replies pill offers the replies the user would
likely send, written by Claude Haiku. Users read [`OVERVIEW.md`](OVERVIEW.md); setup is in
[`README.md`](README.md). The plugin API is documented at https://paseo.sh/docs/plugins/reference.md.

## Layout

| Path | Runs in | Holds |
|---|---|---|
| `index.client.tsx`, `client/` | the Paseo app (React Native, all platforms) | the pill, its popover, the agent subscription |
| `index.server.ts`, `server/` | a daemon subprocess (Node) | the `claude` call |
| `shared/` | both | the Zod RPC contract and pure logic, the only code `test/` covers |

Client code never imports `server/` or `node:*`.

## After every change

```bash
npm run typecheck
npm test
```

Load a change with `paseo plugin reload paseo-replies`, using the Paseo CLI that matches the daemon.

## Rules the code depends on

- **No DOM.** `tsconfig.json` has no DOM library. Declare the globals a module uses (`console`) at its top.
  Use React Native primitives only, and take every colour from `theme.colors`.
- **`claude` isolated.** `server/suggestions.ts` runs Haiku through the user's login with no tools, MCP servers,
  slash commands, settings or saved session, in the temp directory. `--bare` would be simpler but skips the
  OAuth login.
- **No suggestions for old turns.** Only a turn that ends while the app is open is read, so opening the app
  does not call Haiku for every idle agent.
- **Updating a pill's `behavior` closes its open popover.** The popover reads the list live, so a new list
  only updates the pill's label.

## Commits

English, plain, one change per commit.
