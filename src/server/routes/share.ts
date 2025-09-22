import { Router } from 'express';
import { reddit, context, redis } from '@devvit/web/server';
import { asyncHandler } from '../middleware/errorHandler';
import {
  SHARED_LEVEL_REDIS_KEY_PREFIX,
  buildSplashConfig,
  createSharedLevelRecord,
  defaultShareTitle,
  createHexagonIcon
} from '../utils/levelShare';

type UserLevelRecord = {
  id: string;
  name?: string;
  clue: string;
  words: string[];
  seed: string;
  author?: string;
};

const router = Router();

/**
 * Creates a Reddit post for sharing puzzle
 */
router.post('/api/share', asyncHandler(async (req, res) => {
  const { title, text, flair } = req.body;

  if (!title || !text) {
    res.status(400).json({
      status: 'error',
      message: 'Title and text are required'
    });
    return;
  }

  try {
    // Get the subreddit from context
    const subredditName = context.subredditName;

    if (!subredditName) {
      res.status(400).json({
        status: 'error',
        message: 'Subreddit context not available'
      });
      return;
    }

    // Create a new post in the subreddit
    const subreddit = await reddit.getSubredditByName(subredditName);
    const post = await reddit.submitCustomPost({
      subredditName: subreddit.name,
      title: title,
      postData: {
        shared: true,
        text: text,
        flair: flair
      },
    });

    res.json({
      status: 'success',
      postId: post.id,
      url: post.url
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create post'
    });
  }
}));

router.post('/api/share/user-level', asyncHandler(async (req, res) => {
  const { levelId, title } = req.body as { levelId?: string; title?: string };

  if (!levelId) {
    res.status(400).json({
      status: 'error',
      message: 'Level id is required'
    });
    return;
  }

  const { subredditName } = context;
  if (!subredditName) {
    res.status(400).json({
      status: 'error',
      message: 'Subreddit context not available'
    });
    return;
  }

  const levelKey = `hw:ulevel:${levelId}`;
  const rawLevel = await redis.get(levelKey);
  if (!rawLevel) {
    res.status(404).json({
      status: 'error',
      message: 'Level not found'
    });
    return;
  }

  const level = JSON.parse(rawLevel) as UserLevelRecord;
  const splash = buildSplashConfig(level);
  const sharedRecord = createSharedLevelRecord(level, splash.paletteName, splash.letters);
  const postTitle = title?.trim() || defaultShareTitle(level);

  try {
    const post = await reddit.submitCustomPost({
      subredditName,
      title: postTitle,
      splash: {
        appDisplayName: 'HexaWord',
        backgroundUri: splash.backgroundUri,
        buttonLabel: splash.buttonLabel,
        description: splash.description,
        entryUri: 'index.html',
        heading: splash.heading,
        appIconUri: createHexagonIcon()
      },
      postData: {
        shared: true,
        shareType: 'user-level',
        levelId: sharedRecord.levelId,
        clue: sharedRecord.clue,
        words: sharedRecord.words,
        letters: sharedRecord.letters,
        name: sharedRecord.name,
        author: sharedRecord.author,
        sharedAt: sharedRecord.sharedAt,
        palette: sharedRecord.palette
      }
    });

    await redis.set(
      `${SHARED_LEVEL_REDIS_KEY_PREFIX}${post.id}`,
      JSON.stringify(sharedRecord)
    );

    res.json({
      status: 'success',
      postId: post.id,
      url: post.url,
      splash: {
        heading: splash.heading,
        description: splash.description,
        palette: splash.paletteName
      },
      letters: sharedRecord.letters
    });
  } catch (error) {
    console.error('Failed to publish user level:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to publish level'
    });
  }
}));

export default router;
