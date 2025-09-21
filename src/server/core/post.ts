import { context, reddit } from "@devvit/web/server";
import { calculateCycleDay, getChallengeForDay } from "../data/dailyChallenges";

const SPLASH_BACKGROUND_URI =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI5MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDkwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJpbWciIGFyaWEtbGFiZWxsZWRieT0idGl0bGUgZGVzYyI+CiAgPHRpdGxlIGlkPSJ0aXRsZSI+SGV4YVdvcmQgRGFpbHkgQ2hhbGxlbmdlIFNwbGFzaCBCYWNrZ3JvdW5kPC90aXRsZT4KICA8ZGVzYyBpZD0iZGVzYyI+R3JhZGllbnQgYmFja2dyb3VuZCB3aXRoIHN1YnRsZSBoZXhhZ29uIGdyaWQgYW5kIGZvY2FsIGhpZ2hsaWdodCBmb3IgdGhlIEhleGFXb3JkIGRhaWx5IGNoYWxsZW5nZSBzcGxhc2ggc2NyZWVuLjwvZGVzYz4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmdHcmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMUUxQTQ3IiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzJCM0E4QSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMUE1QzczIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ic3BvdGxpZ2h0IiBjeD0iMC41IiBjeT0iMC4zIiByPSIwLjYiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMzUpIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjYwJSIgc3RvcC1jb2xvcj0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA1KSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDApIiAvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxwYXR0ZXJuIGlkPSJoZXhQYXR0ZXJuIiB3aWR0aD0iNjAiIGhlaWdodD0iNTIiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHBhdHRlcm5UcmFuc2Zvcm09InNjYWxlKDEuMikiPgogICAgICA8cGF0aCBkPSJNMzAgMGwyNiAxNXYzMGwtMjYgMTUtMjYtMTVWMTV6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiIHN0cm9rZS13aWR0aD0iMiIgLz4KICAgIDwvcGF0dGVybj4KICAgIDxmaWx0ZXIgaWQ9InNvZnRHbG93IiB4PSItMjAlIiB5PSItMjAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNDAiIC8+CiAgICA8L2ZpbHRlcj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iOTAwIiBmaWxsPSJ1cmwoI2JnR3JhZGllbnQpIiAvPgogIDxyZWN0IHdpZHRoPSIxNjAwIiBoZWlnaHQ9IjkwMCIgZmlsbD0idXJsKCNoZXhQYXR0ZXJuKSIgb3BhY2l0eT0iMC40IiAvPgogIDxjaXJjbGUgY3g9IjExNTAiIGN5PSIyNjAiIHI9IjQyMCIgZmlsbD0idXJsKCNzcG90bGlnaHQpIiAvPgogIDxnIG9wYWNpdHk9IjAuMzUiIGZpbHRlcj0idXJsKCNzb2Z0R2xvdykiPgogICAgPGNpcmNsZSBjeD0iMzAwIiBjeT0iNzgwIiByPSIxODAiIGZpbGw9IiM0Q0UwQjMiIC8+CiAgICA8Y2lyY2xlIGN4PSIxMzQwIiBjeT0iNzIwIiByPSIyMjAiIGZpbGw9IiNGRkIzNDciIC8+CiAgPC9nPgogIDxnIG9wYWNpdHk9IjAuNjUiPgogICAgPHBhdGggZD0iTTkwMCAxNDBsOTAgNTJ2MTA1bC05MCA1Mi05MC01MlYxOTJ6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIiAvPgogICAgPHBhdGggZD0iTTExMDAgMzYwbDkwIDUydjEwNWwtOTAgNTItOTAtNTJWNDEyeiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgLz4KICAgIDxwYXRoIGQ9Ik0xMjYwIDE2MGw5MCA1MnYxMDVsLTkwIDUyLTkwLTUyVjIxMnoiIGZpbGw9InJnYmEoNzYsIDIyNCwgMTc5LCAwLjE1KSIgLz4KICA8L2c+Cjwvc3ZnPg==";

const SPLASH_ICON_URI =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsbGVkYnk9InRpdGxlIGRlc2MiPgogIDx0aXRsZSBpZD0idGl0bGUiPkhleGFXb3JkIEFwcCBJY29uPC90aXRsZT4KICA8ZGVzYyBpZD0iZGVzYyI+SGV4YWdvbmFsIGJhZGdlIHdpdGggc3R5bGl6ZWQgSCBnbHlwaCByZXByZXNlbnRpbmcgdGhlIEhleGFXb3JkIGJyYW5kLjwvZGVzYz4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNvbkdyYWRpZW50IiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM0Q0UwQjMiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzJCNzVGRiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImdseXBoR3JhZGllbnQiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI0ZGRkZGRiIgc3RvcC1vcGFjaXR5PSIwLjk1IiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNFMUVDRkYiIHN0b3Atb3BhY2l0eT0iMC45NSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJkcm9wU2hhZG93IiB4PSItMjAlIiB5PSItMjAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlRHJvcFNoYWRvdyBkeD0iMCIgZHk9IjIwIiBzdGREZXZpYXRpb249IjMwIiBmbG9vZC1jb2xvcj0iIzBCMUQ0MCIgZmxvb2Qtb3BhY2l0eT0iMC40NSIgLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KICA8ZyBmaWx0ZXI9InVybCgjZHJvcFNoYWRvdykiPgogICAgPHBhdGggZD0iTTI1NiAzMmwxOTIgMTEydjIyNEwyNTYgNDgwIDY0IDM2OFYxNDR6IiBmaWxsPSJ1cmwoI2ljb25HcmFkaWVudCkiIC8+CiAgPC9nPgogIDxwYXRoIGQ9Ik0xOTYgMTQ4aDEyMGw2NCAxMTAtNjQgMTEwSDE5NmwtNjQtMTEweiIgZmlsbD0icmdiYSgxMSwgMjksIDY0LCAwLjI1KSIgLz4KICA8cGF0aCBkPSJNMjE2IDE2OGg4MGw0OCA5MC00OCA5MGgtODBsLTQ4LTkweiIgZmlsbD0idXJsKCNnbHlwaEdyYWRpZW50KSIgLz4KICA8cmVjdCB4PSIyNDQiIHk9IjE4OCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjEzNiIgcng9IjEyIiBmaWxsPSIjMTQyODUwIiAvPgogIDxyZWN0IHg9IjI0NCIgeT0iMTg4IiB3aWR0aD0iMjQiIGhlaWdodD0iMTM2IiByeD0iMTIiIGZpbGw9InJnYmEoMjAsIDQwLCA4MCwgMC4zNSkiIC8+CiAgPHJlY3QgeD0iMjQ0IiB5PSIyNDgiIHdpZHRoPSI4NCIgaGVpZ2h0PSIyNCIgcng9IjEyIiBmaWxsPSIjMTQyODUwIiAvPgogIDxyZWN0IHg9IjE4NCIgeT0iMjQ4IiB3aWR0aD0iODQiIGhlaWdodD0iMjQiIHJ4PSIxMiIgZmlsbD0iIzE0Mjg1MCIgLz4KPC9zdmc+";

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

  const heading = formatDayTypeHeading(challenge.dayType);
  const letterPrompt = extractLetterSet(challenge.words);

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: "HexaWord",
      heading,
      description: `Today's clue: ${challenge.clue}. Use these letters to uncover ${challenge.words.length} themed words, keep your streak alive, share your run, and compare progress with friends: ${letterPrompt}.`,
      buttonLabel: "Play the Daily Challenge",
      backgroundUri: SPLASH_BACKGROUND_URI,
      appIconUri: SPLASH_ICON_URI,

      description: `Today's clue: ${challenge.clue}. Use these letters to uncover ${challenge.words.length} themed words and keep your streak alive: ${letterPrompt}. Share your daily run, conquer curated levels, and compare progress with friends.`,
      buttonLabel: "Play the Daily Challenge",
      backgroundUri: "/daily-challenge-splash.svg",
      appIconUri: "/hexaword-icon.svg",
      entryUri: "index.html",
    },
    subredditName: subredditName,
    title: "hexaword",
    postData: {
      splashMeta: {
        cycleDay,
        clue: challenge.clue,
        difficulty: challenge.difficulty,
        dayType: challenge.dayType,
        letters: letterPrompt,
        wordCount: challenge.words.length,
      },
    },
  });
};
