# Replies

After each turn of an agent, a **Replies · n** pill appears above its composer. It opens a popover with the replies you would most likely send to the agent's last message, such as `Commit as is` or `Run the count query first`. Choosing one sends it to the agent as is.

- **As many as make sense.** One reply per real choice the message offers, at most three: a yes or no question gets one or two, a message that only reports something gets at most one obvious next step, or none. When there is nothing to suggest, there is no pill.
- **In your language.** The replies follow the language of your message that started the turn, so an English message quoting German text still gets English replies.
- **Only when it can send.** The pill is hidden while the agent runs a turn and comes back with new replies after it. Turns that ended before the app opened get none, so opening the app does not ask for every idle agent at once.

The replies are written by Claude Haiku, through the `claude` command on the machine the Paseo daemon runs on, with your own login. The call sees the agent's last message and the start of your message before it, nothing else: it has no tools, MCP servers, slash commands, settings or saved session, and runs in the temporary directory, so no project's `CLAUDE.md` is read. Each finished turn costs one small Haiku request. A few seconds pass between the end of a turn and the pill.
