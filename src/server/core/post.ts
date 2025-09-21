import { context, reddit } from "@devvit/web/server";
import { calculateCycleDay, getChallengeForDay } from "../data/dailyChallenges";

const formatDayTypeHeading = (dayType: string): string => {
  const formatted = dayType
    .split(" ")
    .map((segment) =>
      segment
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-")
    )
    .join(" ");
  return `${formatted} Daily Challenge`;
};

const extractLetterSet = (words: string[]): string => {
  const seen = new Set<string>();
  const orderedLetters: string[] = [];

  for (const word of words) {
    for (const char of word.toUpperCase()) {
      if (!/[A-Z]/.test(char) || seen.has(char)) {
        continue;
      }
      seen.add(char);
      orderedLetters.push(char);
    }
  }

  return orderedLetters.join(" · ");
};

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error("subredditName is required");
  }

  const today = new Date();
  const cycleDay = calculateCycleDay(today);
  const challenge = getChallengeForDay(cycleDay);

  const heading = `${formatDayTypeHeading(challenge.dayType)} · Day ${cycleDay}`;
  const letterPrompt = extractLetterSet(challenge.words);
  const buttonLabel = challenge.dayType === "supreme" ? "Begin the Supreme Run" : "Play Today's Challenge";

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: "HexaWord",
      heading,
      description: `${challenge.clue} · Letters: ${letterPrompt}`,
      buttonLabel,
      backgroundUri: "/daily-challenge-splash.svg",
      appIconUri: "/hexaword-icon.svg",
      entryUri: "index.html",
    },
    subredditName: subredditName,
    title: "hexaword",
    postData: {
      cycleDay,
      clue: challenge.clue,
      letters: challenge.words,
      heading,
    },
  });
};
