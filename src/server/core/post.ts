import { context, reddit } from "@devvit/web/server";
import { calculateCycleDay, getChallengeForDay } from "../data/dailyChallenges";
import {
  buildSplashConfig,
  createHexagonIcon
} from "../utils/levelShare";

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error("subredditName is required");
  }

  const today = new Date();
  const cycleDay = calculateCycleDay(today);
  const challenge = getChallengeForDay(cycleDay);

  // Build splash screen configuration
  const splash = buildSplashConfig({
    name: `Day ${cycleDay} - ${challenge.dayType.charAt(0).toUpperCase() + challenge.dayType.slice(1)}`,
    clue: challenge.clue,
    words: challenge.words,
    author: 'HexaWord Team'
  });

  return await reddit.submitCustomPost({
    subredditName: subredditName,
    title: "HexaWord Daily Challenge",
    splash: {
      appDisplayName: 'HexaWord',
      backgroundUri: splash.backgroundUri,
      buttonLabel: 'Start Challenge',
      description: splash.description,
      entryUri: 'index.html',
      heading: splash.heading,
      appIconUri: createHexagonIcon()
    },
    postData: {
      cycleDay,
      clue: challenge.clue,
    },
  });
};