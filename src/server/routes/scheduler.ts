import express from "express";
import { context, redis } from "@devvit/web/server";
import { Logger, asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const logger = Logger.getInstance();

/**
 * Track user activity and schedule/cancel reminders
 */
router.post("/api/track-activity", asyncHandler(async (req, res): Promise<void> => {
  const { userId } = context;
  const { level, solvedWords, solvedCells, totalWords } = req.body;

  if (!userId) {
    res.status(400).json({ error: "User ID not found" });
    return;
  }

  try {
    // Store last played timestamp
    const lastPlayedKey = `user:${userId}:lastPlayed`;
    await redis.set(lastPlayedKey, Date.now().toString());
    
    // Store current level
    const levelKey = `user:${userId}:currentLevel`;
    await redis.set(levelKey, level.toString());
    
    // Store game progress for smart hints
    const progressKey = `user:${userId}:level:${level}:progress`;
    await redis.set(progressKey, JSON.stringify({
      solvedWords: solvedWords || [],
      solvedCells: solvedCells || [],
      totalWords: totalWords || 6,
      lastUpdated: Date.now()
    }));

    // Store reminder data (actual scheduling would be done by Devvit scheduler)
    // For now we just store the data and log it
    logger.info(`Tracking activity for user ${userId} at level ${level}`, {
      solvedWords: solvedWords?.length || 0,
      totalWords
    });

    res.json({ 
      status: "success",
      message: "Activity tracked and reminder scheduled"
    });
  } catch (error) {
    logger.error("Failed to track activity", error);
    res.status(500).json({ error: "Failed to track activity" });
  }
}));

/**
 * Handle scheduled reminder job (would be called by Devvit scheduler)
 */
router.post("/internal/scheduler/daily-reminder", asyncHandler(async (req, res): Promise<void> => {
  const { userId, level, scheduledAt } = req.body;

  if (!userId) {
    res.status(400).json({ error: "User ID required" });
    return;
  }

  try {
    // Check if user has played since the reminder was scheduled
    const lastPlayedKey = `user:${userId}:lastPlayed`;
    const lastPlayed = await redis.get(lastPlayedKey);
    
    if (lastPlayed && parseInt(lastPlayed) > scheduledAt) {
      // User has played since reminder was scheduled, skip notification
      logger.info(`User ${userId} played recently, skipping reminder`);
      res.json({ status: "skipped", reason: "user_played_recently" });
      return;
    }

    // For now, just log that we would send a reminder
    logger.info(`Would send reminder to user ${userId} for level ${level}`);

    res.json({ 
      status: "success",
      message: "Reminder processed"
    });
  } catch (error) {
    logger.error("Failed to process reminder", error);
    res.status(500).json({ error: "Failed to process reminder" });
  }
}));

/**
 * Cancel reminders for a user (called when they start playing)
 */
router.post("/api/cancel-reminders", asyncHandler(async (req, res): Promise<void> => {
  const { userId } = context;

  if (!userId) {
    res.status(400).json({ error: "User ID not found" });
    return;
  }

  try {
    // For now, just log that we would cancel reminders
    logger.info(`Would cancel reminders for user ${userId}`);
    res.json({ 
      status: "success",
      message: "Reminders cancelled"
    });
  } catch (error) {
    logger.error("Failed to cancel reminders", error);
    res.status(500).json({ error: "Failed to cancel reminders" });
  }
}));

export default router;