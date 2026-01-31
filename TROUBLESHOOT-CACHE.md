# Web-LLM Model Download Troubleshooting

## Issue: Cache API Network Errors

Error: `Failed to execute 'add' on 'Cache': Cache.add() encountered a network error`

This happens when the browser tries to cache the 1.5GB model but hits quota limits or network issues.

---

## Solution 1: Clear Browser Cache for localhost

### Chrome
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Left sidebar: **Storage** → **Clear site data**
4. Check **Cache storage**
5. Click **Clear site data**

Then retry the model download.

### Alternative: Incognito Mode
1. Open Chrome Incognito (`Ctrl+Shift+N` or `Cmd+Shift+N`)
2. Go to http://localhost:5173/
3. Try "Initialize Web-LLM"
4. Incognito has larger initial cache quota

---

## Solution 2: Use Smaller Model

Current model: `Phi-3-mini-4k-instruct-q4f16_1-MLC` (~1.5GB)

Try smaller model in `LLMService.ts`:

```typescript
model: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',  // ~1.5GB - too large
// CHANGE TO:
model: 'Qwen2-1.5B-Instruct-q4f16_1-MLC',  // ~900MB - smaller
```

Available smaller models from @mlc-ai/web-llm:
- `Qwen2-1.5B-Instruct-q4f16_1-MLC` (~900MB)
- `TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC` (~800MB)

---

## Solution 3: Wait and Retry (Network Issues)

Sometimes HuggingFace CDN has temporary issues:
1. Wait 5-10 minutes
2. Click "Initialize" again
3. Download resumes from cached chunks

---

## Solution 4: Disable Caching (Not Recommended)

Force Web-LLM to use memory instead of cache (risk: browser crash or memory issues):

```typescript
// In LLMService.ts, initialize():
this.engine = new webllm.MLCEngine({
  initProgressCallback: (report) => {
    console.log(`Loading: ${report.progress.toFixed(1)}% - ${report.text}`);
  },
  logLevel: 'INFO',
  useIndexedDBCache: false,  // ADD THIS LINE
});
```

---

## Solution 5: Use Different Browser

Chrome/Edge: Better Cache API support
Firefox: Cache quota issues more common
Safari: Not supported (no WebGPU)

---

## Solution 6: Switch Cloud API (Best Fallback)

If Web-LLM doesn't work, add OpenAI API fallback:

```typescript
// Check if WebGPU + web-llm works
// If fails, use OpenAI API
```

I can implement this hybrid approach.

---

## Long-term Fix: Pre-download Models

For production, host the model on fast CDN:
1. Download model files manually
2. Host on Cloudflare R2/AWS S3
3. Point Web-LLM to CDN (faster, more reliable)

---

## Current Status

What we know:
- ✅ WebGPU is working (Chrome)
- ✅ Model starts downloading (252MB fetched)
- ❌ Cache API failing to store chunks
- ❌ Download aborts at ~12-14%

---

## Recommendation

**Try in order:**

1. **Clear cache** → Retry download (5 min)
2. **Incognito mode** → Retry (fresh cache quota)
3. **Smaller model** → Switch to 800MB model
4. **Wait 10 min** → Retry (HuggingFace CDN issue)
5. **Hybrid API** → Add OpenAI fallback I'll implement

---

## Tell Me Which to Try

I can:
- **A)** Clear cache instructions (already above)
- **B)** Switch to smaller model (Qwen2-1.5B, ~900MB)
- **C)** Add OpenAI API fallback (best reliability)
- **D)** All of the above setup

Which path?