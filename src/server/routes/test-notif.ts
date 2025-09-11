import express from "express";
import { context, redis } from "@devvit/web/server";
import { NotificationService } from "../services/NotificationService";
import { LevelRepository } from "../services/LevelRepository";
import { Logger, asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const logger = Logger.getInstance();

/**
 * TEST ENDPOINT: Trigger notification immediately for testing
 * This simulates what would happen after 24 hours
 */
router.post("/api/test-notification", asyncHandler(async (req, res): Promise<void> => {
  const { userId } = context;
  const { level = 1, foundWords = 2, totalWords = 6 } = req.body;

  if (!userId) {
    res.status(400).json({ error: "User ID not found" });
    return;
  }

  try {
    // Store test progress
    const progressKey = `user:${userId}:level:${level}:progress`;
    await redis.set(progressKey, JSON.stringify({
      sol