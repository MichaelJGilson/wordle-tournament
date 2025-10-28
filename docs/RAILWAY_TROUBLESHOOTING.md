# Railway Deployment Troubleshooting

## ✅ Latest Fix Applied

**Added `nixpacks.toml`** to explicitly configure Railway build phases:
- Installs root dependencies
- Installs client dependencies
- Builds React app
- Starts server

This should resolve the build failure!

---

## 🔍 What Railway Should Show Now

### Build Logs Should Show:

```bash
# Phase 1: Install
npm install
✓ Added X packages

cd client && npm install
✓ Added 248 packages

# Phase 2: Build
cd client && npm run build
✓ 75 modules transformed
✓ built in XXXms

# Phase 3: Start
npm start
Word Royale server running on port 3000
```

---

## 🐛 If Build Still Fails

### Option 1: Check Railway Logs

Look for specific error messages:
- `npm ERR!` - Dependency issue
- `Module not found` - Missing package
- `ENOENT` - File/folder not found
- `TypeScript error` - Type checking issue

### Option 2: Alternative Build Configuration

If nixpacks.toml doesn't work, try adding a **railway.json**:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && cd client && npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Option 3: Use railway.toml Instead

Create `railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && cd client && npm install && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

---

## 🚨 Common Errors & Solutions

### Error 1: "Cannot find module 'react'"

**Cause**: Client dependencies not installed

**Fix**: Already handled by nixpacks.toml, but verify logs show:
```bash
cd client && npm install
```

### Error 2: "No such file or directory: client/dist"

**Cause**: Build didn't run or failed silently

**Fix**: Check that build logs show:
```bash
✓ built in XXXms
```

If not, the build failed. Look for TypeScript errors above.

### Error 3: "npm ERR! code ELIFECYCLE"

**Cause**: Build script failed

**Check**:
1. Does `npm run build` work locally?
2. Are all dependencies in package.json?
3. Check Railway Node.js version matches local

### Error 4: Build succeeds but page shows blank

**Cause**: Server can't find built files

**Fix**: Verify in server.js:
```javascript
app.use(express.static(path.join(__dirname, 'client/dist')));
```

And that dist folder exists after build.

---

## 🔧 Manual Deployment Test

To test the exact build process Railway uses:

```bash
# Clean start
rm -rf client/node_modules
rm -rf client/dist

# Install (what Railway does)
npm install
cd client && npm install

# Build (what Railway does)
cd client && npm run build

# Check output
ls -la client/dist/

# Start (what Railway does)
cd .. && npm start
```

If this works locally, it should work on Railway.

---

## 📊 Verify Build Artifacts

After build, Railway should have:

```
WordleRoyale/
├── node_modules/           # Root dependencies
├── client/
│   ├── node_modules/       # React dependencies
│   └── dist/              # Built React app ✅
│       ├── index.html
│       └── assets/
│           ├── index-XXX.css
│           └── index-XXX.js
└── server.js
```

The `client/dist/` folder is **critical** - server.js serves from here.

---

## 🎯 Expected Railway Environment

Railway automatically sets:
- `NODE_ENV=production`
- `PORT=<random-port>`
- `RAILWAY_ENVIRONMENT=production`

Our server.js already handles these correctly.

---

## 🔍 Debug Commands

If you have Railway CLI installed:

```bash
# View logs
railway logs

# Check environment
railway env

# Restart service
railway restart

# Open dashboard
railway open
```

---

## 💡 Alternative: Commit dist/ Folder (Not Recommended)

As a **last resort** (not recommended), you could commit the dist folder:

```bash
# Remove dist from .gitignore
cd client
sed -i '/^dist$/d' .gitignore

# Commit dist
git add dist/
git commit -m "Add dist folder for Railway"
git push origin main
```

**But this is not ideal** because:
- Increases repo size
- Needs manual rebuilds
- Goes against best practices

The nixpacks.toml approach is much better!

---

## ✅ Success Checklist

Railway deployment is successful when:

- [ ] Build logs show all 3 phases (install, build, start)
- [ ] No red error messages in logs
- [ ] Server logs show "Word Royale server running on port..."
- [ ] Railway status shows "Active" (green)
- [ ] Your URL loads the React app
- [ ] Browser console shows no errors
- [ ] WebSocket connects successfully

---

## 📞 If All Else Fails

1. **Check Railway Community Discord** - Very helpful!
2. **Review Railway Docs**: https://docs.railway.app/
3. **Try Render.com** - Similar service, different approach
4. **Try Vercel + separate backend** - Split frontend/backend

---

## 🎉 Most Likely Outcome

The `nixpacks.toml` configuration should fix the build issue. Railway will now:

1. ✅ Install root deps
2. ✅ Install client deps separately
3. ✅ Build React app properly
4. ✅ Start server successfully

**Monitor your Railway dashboard - deployment should complete in 2-3 minutes!**

---

**Good luck! The configuration is now optimized for Railway.** 🚀
