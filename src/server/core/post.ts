import { context, reddit } from "@devvit/web/server";
import { calculateCycleDay, getChallengeForDay } from "../data/dailyChallenges";

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error("subredditName is required");
  }

  const today = new Date();
  const cycleDay = calculateCycleDay(today);
  const challenge = getChallengeForDay(cycleDay);

  return await reddit.submitCustomPost({
    subredditName: subredditName,
    title: "HexaWord Daily Challenge",
    postData: {
      cycleDay,
      clue: challenge.clue,
    },
  });
};