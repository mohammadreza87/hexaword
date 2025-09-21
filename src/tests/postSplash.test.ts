import { describe, expect, it } from "vitest";
import {
  buildPostTitle,
  buildSplashDescription,
  formatDayTypeHeading,
  formatLetterPrompt,
  getUniqueLetters,
} from "../server/core/post";

describe("createPost splash helpers", () => {
  it("capitalizes day type segments when building heading", () => {
    expect(formatDayTypeHeading("social")).toBe("Social Daily Challenge");
    expect(formatDayTypeHeading("throwback")).toBe("Throwback Daily Challenge");
    expect(formatDayTypeHeading("night-mode")).toBe("Night-Mode Daily Challenge");
  });

  it("returns a stable list of unique letters in first-seen order", () => {
    expect(getUniqueLetters(["alpha", "beta", "gamma"])).toEqual([
      "A",
      "L",
      "P",
      "H",
      "B",
      "E",
      "T",
      "G",
      "M",
    ]);
  });

  it("joins letters into a display-friendly prompt", () => {
    const prompt = formatLetterPrompt(["A", "B", "C"]);
    expect(prompt).toBe("A · B · C");
  });

  it("builds a descriptive splash summary", () => {
    const description = buildSplashDescription("Cozy theme", "A · B · C", 6);
    expect(description).toBe("Clue: Cozy theme • Letters: A · B · C • Find 6 words");
  });

  it("singularizes the word label when only one word is required", () => {
    const description = buildSplashDescription("Solo", "", 1);
    expect(description).toBe("Clue: Solo • Find 1 word");
  });

  it("formats a detailed reddit post title", () => {
    const title = buildPostTitle(12, "Galaxy", "G · A · L");
    expect(title).toBe("HexaWord Daily Challenge #12: Galaxy (G · A · L)");
  });

  it("omits the letter prompt when none are provided", () => {
    const title = buildPostTitle(5, "Minimal", "");
    expect(title).toBe("HexaWord Daily Challenge #5: Minimal");
  });
});
