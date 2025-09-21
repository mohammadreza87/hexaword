import { Router } from 'express';
import { reddit, context } from '@devvit/web/server';
import { asyncHandler } from '../middleware/errorHandler';

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

export default router;