# Prototype verification

Version 0.2.0 targets the published plugin SDK 0.16.0-beta.2.

- Typecheck and lint pass.
- 25 targeted Vitest checks pass: transcript extraction, output parsing, editable insertion, draft preservation, unavailable composer, focus failure, generation defaults, model selection, isolation flags, disabled generation, model-aware caching, in-flight deduplication, retry, and concurrency limits.
- Paseo's compileDirectoryPlugin accepts both entries and the manifest against 0.16.0-beta.2.
- A browser fixture renders the actual reply-list component through React Native Web with simulated host state. Checked dark desktop and light compact layouts, selection inserting and focusing a draft, existing drafts disabling insertion, and a new turn removing stale replies. The fixture does not verify Paseo's native popover or sheet integration.

Not yet verified in a live Paseo host: installation/reload, real Claude account generation, settings persistence across connected devices, iOS/Android keyboard and sheet behavior. No main daemon was restarted or reconfigured. Treat this as an opt-in prototype, not a fully validated release.
