# Railway Deployment Guide

## ✅ Ready for Deployment!

Your React migration has been pushed to GitHub main branch. Railway will automatically detect and deploy the changes.

---

## 🚀 What Railway Will Do Automatically

When Railway detects the push to main:

1. **Install Dependencies**
   ```bash
   npm install  # Root dependencies
   ```

2. **Run Build Script**
   ```bash
   npm run build  # This runs: cd client && npm install && npm run build
   ```

3. **Start Server**
   ```bash
   npm start  # Runs: node server.js
   ```

4. **Serve React App**
   - Server.js now serves `client/dist/` folder
   - All routes go through React (SPA routing)
   - API routes at `/api/*` work correctly

---

## 📝 Deployment Checklist

### Pre-Deployment (Already Done)
- [x] React app builds successfully
- [x] server.js updated to serve React build
- [x] Build script added to package.json
- [x] All changes committed to main branch
- [x] Pushed to GitHub

### Railway Auto-Deployment
- [ ] Railway detects GitHub push
- [ ] Build process starts
- [ ] React app builds (takes ~1-2 minutes)
- [ ] Server starts
- [ ] Deployment successful ✅

### Post-Deployment Verification
- [ ] Visit your Railway URL
- [ ] Check that React app loads
- [ ] Test Socket.io connection
- [ ] Try creating a game
- [ ] Test matchmaking
- [ ] Verify all features work

---

## 🔍 How to Monitor Deployment

### In Railway Dashboard:

1. **Go to your Railway project**
   - Visit: https://railway.app/project/[your-project-id]

2. **Check Deployment Logs**
   - Click on "Deployments" tab
   - Watch the build logs in real-time
   - Look for:
     ```
     Building client React app...
     ✓ built in X.XXs
     Starting server...
     Word Royale server running on port XXXX
     ```

3. **Check for Errors**
   - Build errors will show in red
   - Server errors appear after "Starting server..."
   - Socket.io connection issues show in runtime logs

---

## 🐛 Common Issues & Solutions

### Issue 1: Build Fails

**Symptoms**: Railway build fails with npm errors

**Solution**:
```bash
# Check if it builds locally first
cd client
npm install
npm run build

# If local build works but Railway fails:
# - Check Railway Node.js version matches local (>=16.0.0)
# - Ensure package-lock.json is committed
```

### Issue 2: Server Starts But Page is Blank

**Symptoms**: Railway deployment succeeds but shows blank page

**Possible Causes**:
- React build files not found
- Wrong path in server.js

**Check**:
```javascript
// In server.js, verify paths are correct:
app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});
```

### Issue 3: Socket.io Connection Fails

**Symptoms**: "Disconnected from server" in browser

**Solution**:
- Check Railway logs for WebSocket errors
- Verify Railway allows WebSocket connections (it does by default)
- Check that Socket.io connection URL is correct in client

### Issue 4: 404 on API Routes

**Symptoms**: API calls return 404

**Check Route Order in server.js**:
```javascript
// API routes MUST come before the catch-all:
app.get('/api/health', ...);     // ✅ First
app.get('/api/games', ...);      // ✅ Second
// ...more API routes...
app.get('*', ...);               // ✅ Last (catch-all)
```

---

## 📊 Expected Build Output

When Railway builds, you should see:

```bash
> npm run build

> word-royale-server@1.0.0 build
> cd client && npm install && npm run build

added 237 packages in 20s

> client@0.0.0 build
> tsc -b && vite build

vite v7.1.12 building for production...
✓ 75 modules transformed.
dist/index.html                  0.45 kB │ gzip:  0.29 kB
dist/assets/index-XXX.css       14.42 kB │ gzip:  3.40 kB
dist/assets/index-XXX.js       255.29 kB │ gzip: 79.10 kB
✓ built in 733ms

> npm start

> word-royale-server@1.0.0 start
> node server.js

Word Royale server running on port 3000
Environment: production
Railway deployment successful!
```

---

## 🎯 Expected Behavior After Deployment

### What Should Work:
✅ React app loads at your Railway URL
✅ Socket.io connects automatically
✅ Main menu shows game modes
✅ Public matchmaking works
✅ Custom room creation works
✅ Real-time gameplay works
✅ All animations and overlays work

### Network Tab Should Show:
- `GET /` → 200 (loads index.html)
- `GET /assets/*.js` → 200 (loads JS bundle)
- `GET /assets/*.css` → 200 (loads CSS)
- `WebSocket /socket.io/` → 101 Switching Protocols (Socket.io)

---

## 🔗 Useful Railway Commands

```bash
# View deployment logs
railway logs

# Check service status
railway status

# Open Railway dashboard
railway open
```

---

## 📱 Testing After Deployment

### Quick Test Checklist:

1. **Load Test**
   - Visit your Railway URL
   - Page should load in <2 seconds
   - No console errors

2. **Connection Test**
   - Check connection status indicator
   - Should show "Connected to server"

3. **Create Game Test**
   - Click "Custom Battle Royale"
   - Enter name and create room
   - Should show lobby with game ID

4. **Matchmaking Test**
   - Click "Join Public Battle Royale"
   - Enter name and join queue
   - Should show queue status

5. **Gameplay Test** (needs 2 players)
   - Open 2 browser tabs
   - Both join same custom game
   - Start game and test guesses

---

## 🎉 Success Indicators

You'll know deployment succeeded when:

✅ Railway deployment status shows "Active"
✅ Your Railway URL loads the React app
✅ Connection status shows "Connected"
✅ No errors in browser console
✅ No errors in Railway logs
✅ Socket.io WebSocket establishes

---

## 📞 If You Need Help

If deployment fails or you see issues:

1. **Check Railway Logs First**
   - Most issues are visible in build/runtime logs

2. **Check Browser Console**
   - F12 → Console tab
   - Look for JavaScript errors

3. **Check Network Tab**
   - F12 → Network tab
   - Look for failed requests (red)

4. **Common Quick Fixes**:
   ```bash
   # Force Railway to rebuild
   git commit --allow-empty -m "Trigger Railway rebuild"
   git push origin main
   ```

---

## 🚀 Next Steps After Deployment

Once deployed successfully:

1. **Share the URL** - Your game is live!
2. **Monitor Performance** - Check Railway metrics
3. **Add Features** - Use React components
4. **Scale if Needed** - Railway auto-scales

---

## 📋 Environment Variables (Optional)

If you need to add environment variables in Railway:

1. Go to Railway Dashboard
2. Click your service
3. Go to "Variables" tab
4. Add:
   - `NODE_ENV=production` (already set by Railway)
   - `PORT` (automatically set by Railway)

---

**Your Word Royale is now deployed! 🎮**

Railway will automatically deploy whenever you push to main branch.

Good luck with your launch! 🚀
