import { describe, expect, it } from "vitest";
import { lastExchange, MESSAGE_LIMIT, parseReplies, suggestionPrompt, USER_MESSAGE_LIMIT } from "../shared/suggestions";

describe("lastExchange", () => {
  it("takes the agent's last message and the user's message that started the turn", () => {
    const items = [
      { type: "user_message", text: "older" },
      { type: "user_message", text: "fix it" },
      { type: "assistant_message", text: "Looking." },
      { type: "reasoning", text: "hmm" },
      { type: "assistant_message", text: "Fixed. Commit?" },
      { type: "turn_completed" },
    ];
    expect(lastExchange(items)).toEqual({ message: "Fixed. Commit?", userMessage: "fix it" });
  });

  it("has no agent message when the last turn has none", () => {
    expect(lastExchange([{ type: "assistant_message", text: "old" }, { type: "user_message", text: "go" }])).toEqual({
      message: null,
      userMessage: "go",
    });
    expect(lastExchange([])).toEqual({ message: null, userMessage: null });
  });

  it("has no user message when the window holds none", () => {
    expect(lastExchange([{ type: "assistant_message", text: "only" }])).toEqual({ message: "only", userMessage: null });
  });

  it("keeps the tail of a long agent message and the start of a long user message", () => {
    const { message, userMessage } = lastExchange([
      { type: "user_message", text: `start${"u".repeat(USER_MESSAGE_LIMIT)}` },
      { type: "assistant_message", text: `${"a".repeat(MESSAGE_LIMIT)}end?` },
    ]);
    expect(message).toHaveLength(MESSAGE_LIMIT);
    expect(message?.endsWith("end?")).toBe(true);
    expect(userMessage).toHaveLength(USER_MESSAGE_LIMIT);
    expect(userMessage?.startsWith("start")).toBe(true);
  });
});

describe("suggestionPrompt", () => {
  it("puts the user's message first, so its language leads", () => {
    expect(suggestionPrompt("Run it?", "check the bounce")).toBe("User's previous message:\ncheck the bounce\n\nAgent's last message:\nRun it?");
    expect(suggestionPrompt("Run it?", null)).toBe("Agent's last message:\nRun it?");
  });
});

describe("parseReplies", () => {
  it("reads the JSON array", () => {
    expect(parseReplies('["Add the test first", "Commit as is"]')).toEqual(["Add the test first", "Commit as is"]);
  });

  it("finds the array inside other text", () => {
    expect(parseReplies('Here you go:\n```json\n["Yes"]\n```')).toEqual(["Yes"]);
  });

  it("keeps brackets inside replies and skips brackets in the prose around the array", () => {
    expect(parseReplies('["Use [0] instead", "Keep \\"]\\" as is"]')).toEqual(["Use [0] instead", 'Keep "]" as is']);
    expect(parseReplies('Options [see above]:\n["Retry", "Skip [3]"]')).toEqual(["Retry", "Skip [3]"]);
    expect(parseReplies('An unclosed [ bracket, then ["Go"]')).toEqual(["Go"]);
  });

  it("keeps three, drops duplicates, blanks, non-strings and long ones", () => {
    expect(parseReplies(JSON.stringify(["Yes", "yes", " ", 3, "x".repeat(81), "No", "Later", "Never"]))).toEqual([
      "Yes",
      "No",
      "Later",
    ]);
  });

  it("drops a reply that only adds agreement or punctuation to an earlier one", () => {
    expect(
      parseReplies(
        JSON.stringify(["Rewrite #3935 with the six steps", "Yes, rewrite #3935 with the six steps", "Skip the rewrite for now"]),
      ),
    ).toEqual(["Rewrite #3935 with the six steps", "Skip the rewrite for now"]);
    expect(parseReplies(JSON.stringify(["Yes", "Yes!", "OK, ship it", "Ship it."]))).toEqual(["Yes", "OK, ship it"]);
  });

  it.each(["", "no array here", "[not json", "[]"])("gives none for %j", (output) => {
    expect(parseReplies(output)).toEqual([]);
  });
});
