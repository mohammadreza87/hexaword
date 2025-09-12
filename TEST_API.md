# Testing User Levels API

## How to Test the User Levels Feature

### 1. Restart Development Server
First, make sure to rebuild and restart your development server:

```bash
# Stop any running dev server (Ctrl+C)
# Then rebuild and restart:
npm run build
npm run dev
```

### 2. Test in Devvit Playtest
```bash
# In a separate terminal:
devvit playtest hexaword_dev
```

### 3. API Endpoints Available

The following endpoints should now be available:

- **POST** `/api/user-levels` - Create a new level
- **GET** `/api/user-levels/mine` - Get current user's levels
- **GET** `/api/user-levels/:id/init` - Get level data for playing

### 4. Testing Flow

1. **Open the game** in your browser from the Devvit playtest
2. **Click "📝 My Levels"** from the main menu
3. **Click "+ Create New Level"** button
4. **Create a test level**:
   - Name: "Test Level" (optional)
   - Clue: "TEST WORDS"
   - Words: "CAT", "DOG", "COW"
5. **Save the level** and see the share dialog
6. **Go back to levels** to see your created level in the list

### 5. Troubleshooting

If you still get 404 errors:

1. **Check server logs** in the terminal running `npm run dev:server`
2. **Verify Redis is connected** - the server needs Redis for storing levels
3. **Check authentication** - you need to be logged in to Reddit (devvit login)
4. **Clear browser cache** and refresh the page

### 6. Manual API Testing

You can also test the API directly using curl or a tool like Postman:

```bash
# Get your levels (replace with your actual dev URL)
curl -X GET "http://localhost:3000/api/user-levels/mine" \
  -H "Content-Type: application/json"

# Create a level
curl -X POST "http://localhost:3000/api/user-levels" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Level",
    "clue": "TEST CLUE",
    "words": ["CAT", "DOG", "COW"]
  }'
```

### 7. Expected Behavior

- **First time**: You'll see "No levels yet" message
- **After creating**: Levels appear in a list with:
  - Level name/clue
  - Word count
  - Words displayed as tags
  - Play and Delete buttons
  - Creation timestamp

### 8. Common Issues

- **404 errors**: Server not restarted after changes
- **401 errors**: Not authenticated with Reddit
- **500 errors**: Check server logs for Redis connection issues
- **Empty list**: Levels are stored per user, make sure you're logged in

## Development Notes

The user levels are stored in Redis with the following structure:
- Level data: `hw:ulevel:{id}`
- User's level list: `hw:ulevels:user:{username}`

Each level includes:
- Unique ID
- Author username
- Name (optional)
- Clue
- Words array
- Seed for puzzle generation
- Creation timestamp
- Visibility status
- Level status