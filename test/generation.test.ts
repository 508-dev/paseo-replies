import { beforeEach, describe, expect, it, vi } from "vitest";
import { preferences } from "../shared/preferences";

const { execute } = vi.hoisted(() => ({
  execute:
    vi.fn<
      (
        file: string,
        args: string[],
        options: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => void
    >(),
}));
vi.mock("node:child_process", () => ({ execFile: execute }));
import { suggestReplies } from "../server/suggestions";

const options = { enabled: true, model: "haiku", executable: "/test/claude" };

beforeEach(() => {
  execute.mockReset();
  execute.mockImplementation((_file, _args, _options, callback) =>
    callback(null, '["Check first"]', ""),
  );
});

describe("generation", () => {
  it("defaults to an independently configured model", () => {
    expect(preferences.schema.parse({})).toEqual({
      enabled: true,
      model: "haiku",
      executable: "claude",
    });
    expect(preferences.schema.safeParse({ model: " " }).success).toBe(false);
  });

  it("passes the chosen model and isolation flags without a shell", async () => {
    await expect(
      suggestReplies(
        { message: "Commit?", userMessage: "Fix fonts" },
        { ...options, model: "sonnet" },
      ),
    ).resolves.toEqual({ replies: ["Check first"] });
    const [file, args, config] = execute.mock.calls[0];
    expect(file).toBe("/test/claude");
    expect(args).toEqual(
      expect.arrayContaining([
        "--model",
        "sonnet",
        "--tools",
        "",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--setting-sources",
        "--no-session-persistence",
      ]),
    );
    expect(config).toMatchObject({ timeout: 30_000 });
    expect(config).not.toHaveProperty("shell");
  });

  it("does no model work when generation is disabled", async () => {
    await expect(
      suggestReplies({ message: "Disabled?", userMessage: null }, { ...options, enabled: false }),
    ).resolves.toEqual({ replies: [] });
    expect(execute).not.toHaveBeenCalled();
  });

  it("caches identical inputs but regenerates for another model or executable", async () => {
    const input = { message: "Cache test?", userMessage: null };
    await suggestReplies(input, options);
    await suggestReplies(input, options);
    expect(execute).toHaveBeenCalledTimes(1);
    await suggestReplies(input, { ...options, model: "opus" });
    await suggestReplies(input, { ...options, executable: "/another/claude" });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("deduplicates concurrent requests from multiple apps", async () => {
    execute.mockImplementation(() => {});
    const input = { message: "Concurrent?", userMessage: null };
    const first = suggestReplies(input, options);
    const second = suggestReplies(input, options);
    expect(execute).toHaveBeenCalledTimes(1);
    execute.mock.calls[0][3](null, '["Wait"]', "");
    await expect(Promise.all([first, second])).resolves.toEqual([
      { replies: ["Wait"] },
      { replies: ["Wait"] },
    ]);
  });

  it("surfaces failures and allows retrying the same input", async () => {
    execute.mockImplementationOnce((_file, _args, _options, callback) =>
      callback(new Error("exit 1"), "", "Login required"),
    );
    const input = { message: "Failure?", userMessage: null };
    await expect(suggestReplies(input, options)).rejects.toThrow("Login required");
    await expect(suggestReplies(input, options)).resolves.toEqual({ replies: ["Check first"] });
  });

  it("bounds distinct concurrent model processes", async () => {
    execute.mockImplementation(() => {});
    const requests = [0, 1, 2, 3].map((id) =>
      suggestReplies({ message: `Bound ${id}`, userMessage: null }, options),
    );
    await expect(
      suggestReplies({ message: "Overflow", userMessage: null }, options),
    ).rejects.toThrow("busy");
    for (const call of execute.mock.calls) call[3](null, "[]", "");
    await Promise.all(requests);
  });
});
