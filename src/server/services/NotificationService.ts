import { redis } from '@devvit/web/server';

export class NotificationService {
  /**
   * Store reminder data for a user (to be scheduled by Devvit)
   */
  static async storeReminderData(
    userId: string,
    currentLevel: number,
    solvedWords?: string[],
    solvedCells?: string[]
  ): Promise<void> {
    // Store reminder data in Redis for later processing
    const reminderKey = `user:${userId}:reminder`;
    const reminderData = {
      userId,
      level: currentLevel,
      solvedWords: solvedWords || [],
      solvedCells: solvedCells || [],
      scheduledAt: Date.now(),
      nextReminderAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };
    
    await redis.set(reminderKey, JSON.stringify(reminderData));
  }

  /**
   * Cancel existing reminders for a user (when they play)
   */
  static async cancelReminders(
    userId: string
  ): Promise<void> {
    // Remove reminder data from Redis
    const reminderKey = `user:${userId}:reminder`;
    await redis.del(reminderKey);
  }

  /**
   * Get a smart hint - reveal a letter from an unsolved word
   */
  static async getSmartHint(
    levelData: any,
    userId: string
  ): Promise<{ letter: string; word: string; position: number }> {
    // Get user's progress for this level
    const progressKey = `user:${userId}:level:${levelData.level}:progress`;
    const progressData = await redis.get(progressKey);
    let solvedWords: string[] = [];
    let solvedCells: Set<string> = new Set();
    
    if (progressData) {
      const progress = JSON.parse(progressData);
      solvedWords = progress.solvedWords || [];
      solvedCells = new Set(progress.solvedCells || []);
    }
    
    // Find unsolved words
    const unsolvedWords = levelData.words.filter((word: string) => 
      !solvedWords.includes(word.toUpperCase())
    );
    
    if (unsolvedWords.length === 0) {
      // All words solved, pick any letter
      return {
        letter: 'E',
        word: 'COMPLETE',
        position: 0
      };
    }
    
    // Pick a random unsolved word
    const targetWord = unsolvedWords[Math.floor(Math.random() * unsolvedWords.length)];
    
    // Find a letter position that hasn't been revealed yet
    // (In a real implementation, you'd check against the actual grid positions)
    const unrevealed: number[] = [];
    for (let i = 0; i < targetWord.length; i++) {
      // Check if this position in this word has been revealed
      // For simplicity, we'll just pick a random position
      unrevealed.push(i);
    }
    
    const position = unrevealed[Math.floor(Math.random() * unrevealed.length)] || 0;
    const letter = targetWord[position].toUpperCase();
    
    return {
      letter,
      word: targetWord.toUpperCase(),
      position
    };
  }

  /**
   * Send the actual notification to the user
   */
  static async sendReminderNotification(
    context: Devvit.Context,
    userId: string,
    level: number,
    hint: { letter: string; word: string; position: number }
  ): Promise<void> {
    try {
      // Get username from userId
      const user = await context.reddit.getUserById(userId);
      
      // Get user's progress stats
      const progressKey = `user:${userId}:level:${level}:progress`;
      const progressData = await redis.get(progressKey);
      let foundCount = 0;
      let totalWords = 6; // Default
      
      if (progressData) {
        const progress = JSON.parse(progressData);
        foundCount = (progress.solvedWords || []).length;
        totalWords = progress.totalWords || 6;
      }
      
      // Create a more personalized message
      let hintMessage = '';
      if (hint.word === 'COMPLETE') {
        hintMessage = `Amazing! You've already found all words in Level ${level}! Time to move to the next level!`;
      } else {
        hintMessage = `You're ${foundCount}/${totalWords} words in! Here's a hint:
        
**The letter "${hint.letter}" appears in the word "${hint.word.substring(0, 2)}..."** 🔤

This will help you find one of the remaining ${totalWords - foundCount} words!`;
      }
      
      const TEST_MODE = process.env.TEST_NOTIFICATIONS === 'true';
      
      if (TEST_MODE) {
        // In test mode, just log the message instead of sending
        console.log('📧 TEST NOTIFICATION - Would send to:', user.username);
        console.log('Subject:', `🎯 HexaWord Level ${level} - Daily Hint!`);
        console.log('Message:');
        console.log(`Hey ${user.username}! 👋`);
        console.log(`You haven't played HexaWord today! Let's continue where you left off.`);
        console.log(`Level ${level} Progress: ${foundCount}/${totalWords} words found`);
        console.log(hintMessage);
        console.log('---');
        console.log(`Hint revealed: "${hint.letter}" from word "${hint.word}"`);
        console.log('================================');
      } else {
        // Send actual private message
        await context.reddit.sendPrivateMessage({
          to: user.username,
          subject: `🎯 HexaWord Level ${level} - Daily Hint!`,
          text: `Hey ${user.username}! 👋

You haven't played HexaWord today! Let's continue where you left off.

**Level ${level} Progress:** ${foundCount}/${totalWords} words found

${hintMessage}

[Continue Playing Level ${level}](https://www.reddit.com/r/YourSubreddit/comments/hexaword)

Remember: The clue for this level will help you find all the words!

Good luck! 🍀`,
        });
      }

      console.log(`${TEST_MODE ? '[TEST] ' : ''}Sent reminder to ${user.username} for level ${level} with hint: ${hint.letter} from word ${hint.word}`);
    } catch (error) {
      console.error('Failed to send reminder notification:', error);
    }
  }
}