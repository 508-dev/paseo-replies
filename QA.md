# Inline prototype verification

This branch requires the unpublished core composer section API. The temporary client type augmentation matches that proposal; it does not add a runtime API to published Paseo clients.

- Typecheck and lint pass against the published SDK plus the proposed section contract.
- Ten additional lifecycle tests cover observed turn completion, selection clearing and inserting, permanent dismissal after typing, rejection of in-flight stale results, new-turn invalidation, draft preservation, retryable failures, startup/reconnect, and teardown. The original 25 parsing, insertion, and generation tests remain in CI.
- A browser fixture renders the actual inline component through React Native Web with simulated host state and the proposed section context. It checks a title with no pill, automatic choices, insertion/focus, removal on selection/typing/new turn, no reappearance after clearing text, and no horizontal overflow in dark desktop/light compact layouts. The repository screenshots come from this fixture.

The core PR has separate registration and host-rendering tests. Live installation into a patched Paseo client, real Claude generation, cross-device settings persistence, and iOS/Android dock/keyboard behavior remain unverified. No main daemon was restarted or reconfigured.
