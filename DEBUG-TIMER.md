# Debug Timer Button Issue

## Problem
User reports: "app loads - can load llm - do fresh task - can save and load task - but NO timer buttons?"

## Likely Cause
The breakdown parsing is failing to extract steps from LLM response.

## Debug Steps
1. Check browser console for "[App]" logs
2. Look for "Parsing breakdown:" output
3. Look for "Total parsed:" output showing steps count
4. If steps.length = 0, timer button won't show

## Expected LLM Format
The prompt asks for format like:
```
Step 1: Do something (5 min)
Step 2: Do something else (10 min)
```

But LLM might return:
```
- [Do something] (5 min)
- [Do something else] (10 min)
```

Or variations.

## Code Changes Made
1. Enhanced `parseBreakdown()` to handle multiple formats
2. Added debug logging to console
3. Added visual debug message when steps.length = 0

## User Action Required
1. Refresh http://localhost:5174/
2. Open browser DevTools (F12) → Console
3. Generate a fresh task breakdown
4. Check console for "[App]" logs
5. Screenshot the logs and share

## Next Fix
Based on console logs, we'll fix the parsing regex to match the actual LLM output.