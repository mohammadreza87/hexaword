# Testing HexaWord Notifications

## 1. Local Testing with Devvit Playtest

Start the development server:
```bash
npm run dev
```

This will:
- Start the client dev server
- Start the server dev server  
- Launch Devvit playtest mode

Then in your browser:
1. Open the playtest URL (usually http://localhost:3000)
2. Play a level and find some words
3. Check that activity is being tracked in the console
4. Wait 24 hours (or modify the delay for testing)

## 2. Test with Shorter Delays (Recommended for Testing)

Modify the delay in `NotificationService.ts` temporarily:

```typescript
// Change from 24 hours to 1 minute for testing
const runAt = new Date(Date.now() + 60 * 1000); // 1 minute instead of 24 hours
```

## 3. Manual Testing with API Endpoints

You can manually trigger the notification system:

```bash
# Track activity (simulates playing)
curl -X POST http://localhost:3000/api/track-activity \
  -H "Content-Type: application/json" \
  -d '{
    "level": 5,
    "sol