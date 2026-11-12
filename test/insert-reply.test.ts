import { describe, expect, it, vi } from "vitest";
import { insertReply } from "../client/insert-reply";

function composer(prompt = "") {
  return { prompt, setPrompt: vi.fn(), focus: vi.fn().mockResolvedValue(undefined) };
}

describe("insertReply", () => {
  it("inserts an editable draft and places the cursor at its end", async () => {
    const target = composer();
    await insertReply(target, "Check fonts first");
    expect(target.setPrompt).toHaveBeenCalledWith("Check fonts first");
    expect(target.focus).toHaveBeenCalledWith({ selection: { start: 17, end: 17 } });
    expect(target.setPrompt.mock.invocationCallOrder[0]).toBeLessThan(
      target.focus.mock.invocationCallOrder[0],
    );
  });

  it("preserves an existing draft without changing focus", async () => {
    const target = composer("My own instructions");
    await expect(insertReply(target, "Merge now")).rejects.toThrow("Clear your draft");
    expect(target.setPrompt).not.toHaveBeenCalled();
    expect(target.focus).not.toHaveBeenCalled();
  });

  it("refuses an unavailable composer", async () => {
    await expect(insertReply(undefined, "Merge now")).rejects.toThrow("unavailable");
  });

  it("surfaces focus failures while keeping the inserted draft", async () => {
    const target = composer();
    target.focus.mockRejectedValueOnce(new Error("Input refused focus"));
    await expect(insertReply(target, "Check first")).rejects.toThrow("Input refused focus");
    expect(target.setPrompt).toHaveBeenCalledWith("Check first");
  });
});
