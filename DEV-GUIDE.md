# FocusMate AI - Development Guide

## Running the Dev Server

### Quick Start
```bash
cd /home/pboe/clawd/focusmate-ai/pwa
npm run dev
```

Server runs at: **http://localhost:5173/** (or :5174 if :5173 in use)

---

## Testing in VS Code

### Option 1: Use Built-in Debugger
1. Open `/home/pboe/clawd/focusmate-ai/pwa` folder in VS Code
2. Press `F5` or click "Run and Debug" (triangle+bug icon)
3. Select which browser to test:
   - **Launch Chrome** (best for WebGPU)
   - **Launch Firefox** (no WebGPU support yet)
   - **Launch Edge** (good for WebGPU)

### Option 2: Manual Browser Testing
1. Run dev server: `npm run dev`
2. Open any browser and navigate to http://localhost:5173/
3. Open browser console (F12) to see debug logs

---

## WebGPU Browser Support

### Browsers that Support WebGPU

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| **Chrome** | 113+ | ✅ Works (with flag) | Requires: `chrome://flags/#enable-unsafe-webgpu` |
| **Edge** | 113+ | ✅ Works (with flag) | Requires: `edge://flags/#enable-unsafe-webgpu` |
| **Firefox** | Nightly | ⚠️ Experimental | Not in stable yet |

### Browsers WITHOUT WebGPU Support

| Browser | Status | Notes |
|---------|--------|-------|
| **Firefox stable** | ❌ No | Not yet supported |
| **Safari** | ❌ No | Not supported |
| **Older Chrome/Edge** | ❌ No | Update to latest |

---

## Enabling WebGPU in Chrome/Edge

### Chrome (Mac/Windows/Linux)
1. Open Chrome
2. Go to: `chrome://flags/#enable-unsafe-webgpu`
3. Change "Default" to "Enabled"
4. Click "Relaunch"
5. Restart Chrome

### Edge (Windows)
1. Open Edge
2. Go to: `edge://flags/#enable-unsafe-webgpu`
3. Change "Default" to "Enabled"
4. Click "Relaunch"
5. Restart Edge

### Verify WebGPU is Enabled
Open the app at http://localhost:5173/
- Status should show: "WebGPU: ✓ Supported (fast)"
- If shows "✗ Not supported", flag not enabled or browser doesn't support it

---

## Testing WebGPU Support

### Test 1: Chrome with WebGPU Enabled
```bash
# 1. Enable WebGPU in Chrome
# chrome://flags/#enable-unsafe-webgpu -> Enabled -> Relaunch

# 2. In VS Code: Press F5 -> Select "Launch Chrome"

# 3. Or manually:
npm run dev
# Open Chrome, go to http://localhost:5173/

# Expected:
# Status shows: "WebGPU: ✓ Supported (fast)"
# Initialize button works
# Model loads in 1-3 minutes
# Breakdown generates in 2-5 seconds
```

### Test 2: Chrome WITHOUT WebGPU
```bash
# 1. Disable or don't enable WebGPU flag

# 2. Open Chrome to http://localhost:5173/

# Expected:
# Status shows: "WebGPU: ✗ Not supported"
# Initialize button shows error:
# "WebGPU not available in your browser"
```

### Test 3: Firefox Stable
```bash
# 1. Run npm run dev

# 2. Open Firefox to http://localhost:5173/

# Expected:
# Status shows: "WebGPU: ✗ Not supported"
# Initialize button shows error:
# "WebGPU not available in your browser"
```

---

## Performance Benchmarks

### With WebGPU (Chrome/Edge enabled)
- Model download: 1-3 minutes
- First breakdown: 2-5 seconds
- Cache hit: < 1ms (instant)
- Memory: ~1.5GB (browser-allocated)

### Without WebGPU (CPU fallback - not yet implemented)
- **Note:** @mlc-ai/web-llm requires WebGPU - no CPU fallback available
- For broad support, need to add:
  - transformers.js (WASM, works everywhere, 2-5x slower)
  - OR cloud API fallback (OpenAI/Anthropic)

---

## Debug Logs

The app has extensive logging. Open browser console (F12):

```javascript
// Expected logs on startup:
[ResponseCache.ts] File loading...
[ResponseCache.ts] CacheEntry type exported
[LLMService.ts] File loading...
[LLMService.ts] cacheModule: Object { responseCache: {...} }
[LLMService.ts] WebGPU supported: true/false
[LLMService] Constructor called - mode: Web-LLM

// Expected logs when initializing:
[LLMService] Initializing Web-LLM...
[LLMService] WebGPU supported: true
[LLMService] Loading model: Phi-3-mini-4k-instruct...
[LLMService] Loading: 0.0% - Initializing
[LLMService] Loading: 10.0% - Downloading weights...
// ... continues to 100%
[LLMService] Web-LLM initialized successfully!

// Expected logs on first task:
[LLMService] Generating breakdown for: clean the kitchen
[LLMService] Generated response in 2500ms
[ResponseCache] CACHE MISS: "clean the kitchen" - CACHED NOW

// Expected logs on repeated task:
[ResponseCache] CACHE HIT: "clean the kitchen"
[LLMService] Using cached response
```

---

## Troubleshooting

### Problem: "WebGPU not available"
**Solution:** Enable WebGPU flag in Chrome/Edge (see above)

### Problem: Model download stuck
**Solution:**
- Check network connection
- Some browsers block large downloads on mobile data
- Try on WiFi or desktop

### Problem: "Module not found" error
**Solution:**
- Clear Vite cache: `rm -rf node_modules/.vite`
- Restart dev server
- Hard refresh browser (Ctrl+Shift+R)

### Problem: Blank page
**Solution:**
1. Open browser console (F12)
2. Look for errors (red text)
3. Report the full error message

### Problem: Cache not working
**Solution:**
- Check console for cache logs
- Check localStorage in DevTools (Application tab)
- Try clearing cache with "Clear Cache" button

---

## Architecture Overview

```
User Input (task)
    ↓
ResponseCache.get(task) ← Check localStorage first
    ↓
if cache hit → Return cached response (< 1ms)
if cache miss →
    ↓
Web-LLM.generate(prompt) (2-5s with WebGPU)
    ↓
ResponseCache.set(task, response) ← Save for future
    ↓
Return to user
```

---

## Project Structure

```
pwa/
├── src/
│   ├── llm/
│   │   ├── LLMService.ts          - Web-LLM wrapper
│   │   └── ResponseCache.ts       - Caching layer
│   ├── App.tsx                    - Main UI
│   └── App.css                    - Styles
├── .vscode/
│   └── launch.json                - Browser launch configs
├── memory/
│   └── 2026-01-31.md              - Development log
└── package.json
```

---

## Future Plans

### If WebGPU Works Well (Current Path)
- ✅ Keep @mlc-ai/web-llm
- Build timer integration
- Add SQLite persistence
- Pattern learning (track actual time vs estimated)
- Voice input (Web Speech API)

### If WebGPU Not Feasible
- Option A: Add transformers.js fallback (slower, works everywhere)
- Option B: Add cloud API fallback (OpenAI, faster but not offline)
- Option C: Hybrid (cache frequent tasks locally, cloud for complex)

---

## Need Help?

1. **Browser issues:** Check WebGPU support section above
2. **Model loading:** Ensure Chrome/Edge with WebGPU enabled
3. **Cache issues:** Check localStorage in DevTools
4. **Other:** Open console (F12), check for errors, report full message