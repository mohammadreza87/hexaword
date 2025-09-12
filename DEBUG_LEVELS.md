# Debugging User Levels

## What Was Fixed

### 1. **Validation Schema Mismatch**
- Server was expecting max 8 characters for words
- Client allows up to 12 characters
- **Fixed**: Server now accepts 2-12 character words

### 2. **Name Field Validation**
- Server required minimum 3 characters for name
- Name is optional, so this was too strict
- **Fixed**: Name now requires only 1+ characters when provided

### 3. **Better Error Messages**
- Added detailed logging on both client and server
- Validation errors now show specific field issues
- Console logs show exact payload being sent

### 4. **Authentication Handling**
- Server now allows anonymous users in development
- Won't fail if Reddit auth is unavailable

## How to Test Now

1. **Restart your dev server**:
```bash
npm run dev
```

2. **Open browser console** (F12) to see debug logs

3. **Try creating a level**:
   - Click "📝 My Levels"
   - Click "+ Create New Level"
   - Enter:
     - Name: (leave empty or enter any text)
     - Clue: "TEST" (at least 3 chars)
     - Words: "CAT", "DOG", "COW"
   - Click Next → Save

4. **Check console for debug info**:
   - Client console shows: `Sending level data: {name: ..., clue: ..., words: [...]}`
   - Server console shows: `Create level request body: {...}`

## Common Issues and Solutions

### Still getting 400 error?
Check browser console for the exact validation error:
- `clue: String must contain at least 3 character(s)` - Clue too short
- `words: Array must contain at least 1 element(s)` - No words entered
- `words.0: String must contain at least 2 character(s)` - Word too short

### Still getting 500 error?
Check server console for Redis errors:
- Make sure Redis is running
- Check if you have write permissions

### Testing Without Authentication
The server now uses 'anonymous' as username if not authenticated, so levels will save but under anonymous user.

## What to Look For

### Success Response
```json
{
  "id": "ul_xxx",
  "author": "anonymous",
  "name": "Your Level Name",
  "clue": "YOUR CLUE",
  "words": ["WORD1", "WORD2"],
  "seed": "ulevel:anonymous:ul_xxx",
  "createdAt": "2024-01-12T...",
  "visibility": "private",
  "status": "active"
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "clue: String must contain at least 3 character(s)",
    "details": [...]
  }
}
```

## Quick Test Commands

You can also test directly with curl:

```bash
# Test create level
curl -X POST http://localhost:3000/api/user-levels \
  -H "Content-Type: application/json" \
  -d '{"clue":"TEST CLUE","words":["CAT","DOG"]}'

# Test get levels
curl http://localhost:3000/api/user-levels/mine
```