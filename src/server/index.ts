import express from "express";
import {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
} from "../shared/types/api";
import {
  createServer,
  context,
  getServerPort,
  reddit,
  redis,
} from "@devvit/web/server";
import { createPost } from "./core/post";
import { gameRouter } from "./routes/game";
import colormindRouter from "./routes/colormind";
import { requestLogger, errorHandler, Logger, asyncHandler } from "./middleware/errorHandler";
import progressRouter from "./routes/progress";

const app = express();
const logger = Logger.getInstance();

// Request logging middleware
app.use(requestLogger);

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<
  { postId: string },
  InitResponse | { status: string; message: string }
>("/api/init", asyncHandler(async (req, res): Promise<void> => {
  const { postId } = context;
  const requestId = (req as any).requestId;

  if (!postId) {
    logger.error("postId not found in devvit context", undefined, { requestId });
    res.status(400).json({
      status: "error",
      message: "postId is required but missing from context",
    });
    return;
  }

  logger.debug("Fetching init data", { postId, requestId });
  
  const [count, username] = await Promise.all([
    redis.get("count"),
    reddit.getCurrentUsername(),
  ]);

  res.json({
    type: "init",
    postId: postId,
    count: count ? parseInt(count) : 0,
    username: username ?? "anonymous",
  });
}));

router.post<
  { postId: string },
  IncrementResponse | { status: string; message: string },
  unknown
>("/api/increment", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  res.json({
    count: await redis.incrBy("count", 1),
    postId,
    type: "increment",
  });
});

router.post<
  { postId: string },
  DecrementResponse | { status: string; message: string },
  unknown
>("/api/decrement", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  res.json({
    count: await redis.incrBy("count", -1),
    postId,
    type: "decrement",
  });
});

router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: "success",
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

app.use(router);
app.use(gameRouter);
app.use(colormindRouter);
app.use(progressRouter);

// Error handler middleware (must be last)
app.use(errorHandler);

const server = createServer(app);
server.on("error", (err) => {
  logger.error("Server error", err);
});

const port = getServerPort();
server.listen(port, () => {
  logger.info(`Server started`, { port });
});
