# Suggested replies you can edit

After an agent finishes a turn, a Replies pill offers up to three possible next messages. Choose one to fill the empty composer, edit it, and send when ready. Existing drafts are preserved.

Both your app and daemon need Paseo 0.16.0-beta.2 or later. Install and log in to Claude Code on the daemon host. In the plugin's settings, choose the Claude model, change its executable path, or disable future generation. The default model is Haiku, independently of the model your conversation uses.

The plugin sends the last assistant message (up to 4,000 characters) and preceding user message (up to 500 characters) through that CLI to its model provider. Generation has no tools, MCP servers, project settings, hooks, or saved session. Generation can incur usage charges under your configured account.

This prototype uses the existing pill and popover surfaces. Inline completion and Tab-to-accept are not implemented. An open client must observe the turn ending; opening an old conversation does not generate replies. Failures offer a retry action.
