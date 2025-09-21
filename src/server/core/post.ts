import { context, reddit } from "@devvit/web/server";
import { calculateCycleDay, getChallengeForDay } from "../data/dailyChallenges";

const LETTER_SEPARATOR = " · ";

export const formatDayTypeHeading = (dayType: string): string => {
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

export const getUniqueLetters = (words: string[]): string[] => {
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

  return orderedLetters;
};

export const formatLetterPrompt = (letters: string[]): string =>
  letters.join(LETTER_SEPARATOR);

export const buildSplashDescription = (
  clue: string,
  letterPrompt: string,
  wordCount: number
): string => {
  const parts = [`Clue: ${clue}`];

  if (letterPrompt) {
    parts.push(`Letters: ${letterPrompt}`);
  }

  const wordLabel = wordCount === 1 ? "word" : "words";
  parts.push(`Find ${wordCount} ${wordLabel}`);

  return parts.join(" • ");
};

export const buildPostTitle = (
  cycleDay: number,
  clue: string,
  letterPrompt: string
): string => {
  const titleBase = `HexaWord Daily Challenge #${cycleDay}: ${clue}`;
  return letterPrompt ? `${titleBase} (${letterPrompt})` : titleBase;
};

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error("subredditName is required");
  }

  const today = new Date();
  const cycleDay = calculateCycleDay(today);
  const challenge = getChallengeForDay(cycleDay);


  const heading = formatDayTypeHeading(challenge.dayType);
  const letters = getUniqueLetters(challenge.words);
  const letterPrompt = formatLetterPrompt(letters);
  const description = buildSplashDescription(
    challenge.clue,
    letterPrompt,
    challenge.words.length
  );
  const title = buildPostTitle(cycleDay, challenge.clue, letterPrompt);

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
    title,
    postData: {
      cycleDay,
      clue: challenge.clue,
      dayType: challenge.dayType,
      letters,
      letterPrompt,
      words: challenge.words,
    },
  });
};
