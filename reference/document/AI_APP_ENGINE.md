# AI App Engine - Implementation Roadmap

## Goal
Websim-style AI app generator: User types prompt → AI generates HTML app → Save & Execute in iframe

## Tech Stack
- **AI**: Google Gemini API (gemini-2.0-flash-exp)
- **Frontend**: Next.js (apps folder)
- **Backend**: Cafe24 PHP
- **Execution**: Existing Window Manager + iframe

---

## Implementation Status

### ✅ Phase 1: AI Prompt UI (COMPLETED)
**Location**: `apps/app/ai-generator/page.tsx`

**Completed Features:**
- ✅ Textarea for user prompt
- ✅ App type selector (General/3D/Game/DataViz)
- ✅ Generate button with loading state
- ✅ AI response streaming display
- ✅ Preview iframe with safety CSS injection
- ✅ "Save to MOABOM" button (UI only)
- ✅ MOABOM theme integration (useMoabomTheme)
- ✅ User info display (getMoabomUser)
- ✅ Glass-panel design matching cpap-mask

**Environment Variables:**
```
GEMINI_API_KEY=<your-gemini-api-key>
```

---

### ✅ Phase 2: AI Generation Logic (COMPLETED)
**Location**: `apps/app/api/generate/`

**API Structure (Type-based):**
```
apps/app/api/generate/
├── general/route.ts    → /api/generate/general
├── 3d/route.ts         → /api/generate/3d
├── game/route.ts       → /api/generate/game
└── dataviz/route.ts    → /api/generate/dataviz
```

**Completed Features:**
- ✅ Type-specific prompt templates
- ✅ System defense mechanisms (memory leak prevention, infinite loop prevention)
- ✅ Safe Mode error handling with retry button
- ✅ Non-streaming response (8000 token limit)
- ✅ HTML extraction with fallback patterns
- ✅ Safety CSS/JS injection (chart instance management, container limits)

**Defense Mechanisms:**
1. **Memory Management**: Event listener cleanup, interval/timeout clearing, Three.js dispose
2. **Loop Safety**: Max iteration limits, recursive depth limits
3. **Error Handling**: Try-catch wrapping, user-friendly error messages, restart buttons
4. **Resource Limits**: Polygon count limits, entity count limits, data point limits

---

### ✅ Phase 2.5: MOABOM Integration (COMPLETED)
**Location**: `moabom_cafe24/theme/moabom/`

**Completed Features:**
- ✅ Added to index.php presets (apps mode)
- ✅ WindowManager.js: appUrl parameter support
- ✅ main.js: URL extraction and passing
- ✅ Iframe loading with sandbox attributes
- ✅ Loading overlay removal on iframe load

**Integration Details:**
```javascript
// index.php preset
["id"=>"ai-generator","type"=>"iframe","name"=>"AI 앱 생성기",
 "url"=>"http://localhost:3000/ai-generator",
 "iconClass"=>"ri-sparkling-line",
 "color"=>"linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(219, 39, 119) 100%)"]
```

---

### ✅ Phase 3: Save to Cafe24 (COMPLETED)
**Location**: `moabom_cafe24/save_app.php`, `moabom_cafe24/ai_apps.php`

**Completed Features:**
- ✅ PHP save endpoint (`save_app.php`)
- ✅ Database schema for user_apps table
- ✅ HTML sanitization (basic dangerous tags removal)
- ✅ File storage system (`/data/user_apps/{user_id}/`)
- ✅ User authentication check
- ✅ Rate limiting (10 apps per hour)
- ✅ App library UI (`ai_apps.php`)
- ✅ Delete app functionality (`delete_app.php`)
- ✅ View app page (`view_app.php`)
- ✅ PostMessage communication (Next.js → PHP)
- ✅ MOABOM integration ("내 AI 앱" preset)

**Endpoint Spec:**
```
POST /save_app.php
Body: { 
  html: string, 
  title: string, 
  type: string,
  user_id: string 
}
Response: { 
  success: boolean,
  app_id: string, 
  url: string,
  message: string
}
```

**Storage Strategy:**
- Path: `/data/user_apps/{user_id}/{timestamp}_{title}.html`
- Size limit: 5MB per app
- Sanitization: Removes dangerous tags (iframe, object, embed, etc.)
- Permissions: 0707 for directories, 0606 for files

**Database Schema:**
```sql
CREATE TABLE user_apps (
  app_id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  app_type ENUM('general', '3d', 'game', 'dataviz'),
  html_content LONGTEXT,
  file_path VARCHAR(500),
  file_size INT,
  created_at DATETIME,
  updated_at DATETIME,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  is_public BOOLEAN DEFAULT 1,
  parent_app_id VARCHAR(50),
  version INT DEFAULT 1,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

**Security Features:**
- User authentication check
- Rate limiting (10 apps/hour)
- File size limit (5MB)
- HTML sanitization
- SQL injection prevention
- File permission control

---

### ⬜ Phase 4: Enhanced Features (NEXT)

## Advanced Features (Future Phases)

### Phase 6: Error Monitoring & AI Repair
**Goal**: Detect runtime errors in user apps and suggest fixes

**Implementation:**
1. **Error Capture Layer**
```javascript
// In saved user apps, inject error listener
window.addEventListener('error', (e) => {
  window.parent.postMessage({
    type: 'RUNTIME_ERROR',
    error: { message: e.message, stack: e.error.stack }
  }, '*');
});
```

2. **AI Repair Bot**
- Collect error logs from user apps
- If error occurs > 3 times, trigger AI analysis
- AI suggests fix or auto-patches code
- User approves/rejects patch

**Benefits:**
- Improve app quality over time
- Reduce support burden
- Community-driven bug fixing

---

### Phase 7: Performance Monitoring
**Goal**: Measure and optimize app performance

**Metrics to Track:**
- FPS (Frames Per Second)
- Memory usage (heap size)
- GPU utilization (WebGL context)
- Load time
- Bundle size

**Implementation:**
```javascript
// Performance measurement on app upload
const performanceScore = {
  fps: measureFPS(),
  memory: measureMemory(),
  gpu: measureGPU(),
  loadTime: measureLoadTime()
};

// Assign grade: A, B, C, D, F
const grade = calculateGrade(performanceScore);
```

**UI Display:**
- Show performance badge on app card
- "Optimized" badge for A-grade apps
- Warning for D/F-grade apps

---

### Phase 8: Fork & Version Control
**Goal**: Enable collaborative app development

**Features:**
1. **Fork Button**
- Copy app to user's library
- Track parent_app_id in database
- Show "Forked from @username" badge

2. **Version History**
- Save each edit as new version
- Allow rollback to previous versions
- Show diff between versions

3. **Collaboration**
- Share edit link with other users
- Real-time collaborative editing (optional)

**Database Schema:**
```sql
-- Already included in user_apps table
parent_app_id VARCHAR(50),
version INT DEFAULT 1
```

---

### Phase 9: MOABOM SDK
**Goal**: Provide standard API for user apps

**SDK Features:**
```javascript
// Injected into all user apps
window.MOABOM = {
  // User info
  getUser: () => ({ id, name, avatar }),
  
  // UI interactions
  showToast: (message, type) => {},
  showModal: (title, content) => {},
  
  // Data persistence
  saveData: (key, value) => {},
  loadData: (key) => {},
  
  // Social features
  like: (appId) => {},
  share: (appId) => {},
  
  // Analytics
  trackEvent: (eventName, data) => {}
};
```

**Benefits:**
- Consistent API across all apps
- Easy integration with MOABOM features
- Better user experience

---

### Phase 10: Asset CDN & Optimization
**Goal**: Optimize 3D models and images

**Features:**
1. **Asset Upload**
- Separate endpoint for uploading assets
- Automatic compression (images, 3D models)
- CDN distribution

2. **Optimization Pipeline**
- Image: WebP conversion, resizing
- 3D Models: Draco compression, LOD generation
- Videos: Adaptive bitrate streaming

3. **Usage in Apps**
```javascript
// User apps can reference optimized assets
<img src="https://cdn.moabom.com/assets/{user_id}/{asset_id}.webp">
```

---

## Security Checklist

### ✅ Completed
- [x] Iframe sandbox: `allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin`
- [x] Safety CSS injection (container limits, max-height)
- [x] Safety JS injection (Chart.js instance management)
- [x] Client-side error handling (Safe Mode)

### ⬜ TODO
- [ ] HTML sanitization in PHP (DOMPurify)
- [ ] Rate limiting on API (max 10 generations per hour)
- [ ] User authentication check
- [ ] File size limit (5MB per app)
- [ ] XSS prevention (CSP headers)
- [ ] SQL injection prevention (prepared statements)

---

## Performance Optimization

### Current Optimizations
- ✅ Non-streaming response (simpler, more reliable)
- ✅ 8000 token limit (prevents timeout)
- ✅ Type-specific API routes (better caching)
- ✅ Safety CSS injection (prevents infinite resize loops)

### Future Optimizations
- [ ] Response caching (Redis)
- [ ] CDN for generated apps
- [ ] Lazy loading for app library
- [ ] Thumbnail generation (server-side)
- [ ] Database indexing (user_id, created_at)

---

## Testing Checklist

### Phase 1-2 (Completed)
- [x] Generate general app (calculator)
- [x] Generate 3D app (rotating cube)
- [x] Generate game (Tetris)
- [x] Generate chart (bar chart)
- [x] Test error handling (invalid prompt)
- [x] Test safety CSS (chart resize prevention)
- [x] Test MOABOM integration (iframe loading)

### Phase 3 (Completed)
- [x] Save app to database
- [x] Load saved app from database
- [x] Test HTML sanitization
- [x] Test file size limit
- [x] Test rate limiting
- [x] Test app library UI
- [x] Test app deletion
- [x] Test search and filter

### Phase 4 (Next)
- [ ] Test thumbnail generation
- [ ] Test app editing
- [ ] Test app sharing
- [ ] Test like/favorite system

---

## Deployment Notes

### Development
- Next.js dev server: `http://localhost:3000`
- MOABOM dev server: `http://localhost` (Apache/PHP)

### Production
- Next.js: Deploy to Vercel or self-host
- Update MOABOM iframe URL to production domain
- Set up CORS for cross-origin postMessage
- Configure CDN for static assets

---

## Known Issues & Limitations

### Current Issues
1. **Chart.js duplicate instance error**: Partially fixed with safety script, but AI sometimes ignores instructions
2. **Long code truncation**: 8000 token limit may cut off complex apps
3. **No streaming**: Simpler but less interactive UX

### Workarounds
1. Safety script intercepts Chart constructor
2. Increase token limit to 8000 (from 4000)
3. Show full response in "AI Response" section

### Future Improvements
- Add streaming back with better error handling
- Implement code continuation (if truncated, ask AI to continue)
- Better prompt engineering for Chart.js

---

## Resources

### Documentation
- [Gemini API Docs](https://ai.google.dev/docs)
- [Chart.js Docs](https://www.chartjs.org/docs/)
- [Three.js Docs](https://threejs.org/docs/)
- [Phaser 3 Docs](https://photonstorm.github.io/phaser3-docs/)

### Inspiration
- [WebSim.ai](https://websim.ai) - AI web app generator
- [CodePen](https://codepen.io) - Code sharing platform
- [Glitch](https://glitch.com) - Collaborative coding

---

## Next Steps

**Immediate (This Week):**
1. ✅ Create PHP save endpoint (`save_app.php`)
2. ✅ Set up database table (`user_apps`)
3. ✅ Implement postMessage communication
4. ✅ Test save/load flow
5. ✅ Create app library UI (`ai_apps.php`)
6. ✅ Add delete functionality

**Short-term (This Month):**
7. Add thumbnail generation (html2canvas)
8. Implement edit functionality
9. Add share functionality
10. Implement like/favorite system

**Long-term (Next Quarter):**
11. Error monitoring system
12. Performance measurement
13. Fork & version control
14. MOABOM SDK
