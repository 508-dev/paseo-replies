import { describe, expect, it, vi } from "vitest";
import type { AgentListener } from "../client/agents";
import { createReplies } from "../client/replies";

function fixture() {
  let listener: AgentListener | null = null;
  const statuses = new Map([["agent", "idle"]]);
  const workspaces = new Map([["agent", "workspace"]]);
  const target = {
    prompt: "",
    setPrompt: vi.fn((text: string) => {
      target.prompt = text;
    }),
    focus: vi.fn(async () => {}),
  };
  const generate = vi.fn(async () => ({ replies: ["Check fonts first", "Hold the merge"] }));
  const release = vi.fn();
  const replies = createReplies({
    agents: {
      statuses,
      workspaces,
      ids: () => statuses.keys(),
      listen(next) {
        listener = next;
        return release;
      },
      stop() {},
    },
    readExchange: async () => ({ message: "Merge now?", userMessage: "Fix fonts" }),
    generate,
    composer: () => target,
  });
  function reset() {
    listener?.reset();
  }
  function status(next: string) {
    statuses.set("agent", next);
    listener?.changed("agent");
  }
  reset();
  return { replies, target, generate, release, status, reset, workspaces };
}

describe("inline reply lifecycle", () => {
  it("does not generate for idle agents at startup or reconnect", () => {
    const f = fixture();
    f.reset();
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.replies.snapshot("agent")).toBeNull();
  });
  it("offers suggestions when an observed turn ends", async () => {
    const f = fixture();
    f.status("running");
    f.status("idle");
    await vi.waitFor(() =>
      expect(f.replies.snapshot("agent")).toEqual({
        status: "ready",
        replies: ["Check fonts first", "Hold the merge"],
      }),
    );
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it("hides immediately on acceptance and fills the normal composer without sending", async () => {
    const f = fixture();
    await f.replies.retry("agent");
    const pending = f.replies.accept("agent", "Check fonts first");
    expect(f.replies.snapshot("agent")).toBeNull();
    expect(f.target.prompt).toBe("Check fonts first");
    await pending;
    expect(f.target.focus).toHaveBeenCalledTimes(1);
    await expect(f.replies.accept("agent", "Hold the merge")).rejects.toThrow("no longer current");
  });
  it("does not resurrect dismissed suggestions when typing is cleared", async () => {
    const f = fixture();
    await f.replies.retry("agent");
    f.target.prompt = "My own reply";
    f.replies.dismiss("agent");
    f.target.prompt = "";
    expect(f.replies.snapshot("agent")).toBeNull();
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it("ignores an in-flight result after typing dismisses it", async () => {
    const f = fixture();
    let resolve: (value: { replies: string[] }) => void = () => {};
    f.generate.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = f.replies.retry("agent");
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledTimes(1));
    f.replies.dismiss("agent");
    resolve({ replies: ["Stale"] });
    await pending;
    expect(f.replies.snapshot("agent")).toBeNull();
  });
  it("clears suggestions on a new turn and refuses stale acceptance", async () => {
    const f = fixture();
    await f.replies.retry("agent");
    f.status("running");
    expect(f.replies.snapshot("agent")).toBeNull();
    await expect(f.replies.accept("agent", "Check fonts first")).rejects.toThrow(
      "no longer current",
    );
    expect(f.target.setPrompt).not.toHaveBeenCalled();
  });
  it("skips generation when the user already has a draft", async () => {
    const f = fixture();
    f.target.prompt = "My own reply";
    await f.replies.retry("agent");
    expect(f.generate).not.toHaveBeenCalled();
  });
  it("preserves a draft if it appeared before acceptance", async () => {
    const f = fixture();
    await f.replies.retry("agent");
    f.target.prompt = "Keep this";
    await expect(f.replies.accept("agent", "Check fonts first")).rejects.toThrow(
      "Clear your draft",
    );
    expect(f.target.prompt).toBe("Keep this");
  });
  it("exposes generation failures and replaces them on retry", async () => {
    const f = fixture();
    f.generate.mockRejectedValueOnce(new Error("Login required"));
    await f.replies.retry("agent");
    expect(f.replies.snapshot("agent")).toEqual({ status: "error", message: "Login required" });
    await f.replies.retry("agent");
    expect(f.replies.snapshot("agent")?.status).toBe("ready");
  });
  it("stops observing and discards pending results on teardown", async () => {
    const f = fixture();
    f.replies.stop();
    await f.replies.retry("agent");
    expect(f.release).toHaveBeenCalledTimes(1);
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.replies.snapshot("agent")).toBeNull();
  });
});
