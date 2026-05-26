<<<<<<< HEAD
# Deployment Guide for PrepTalk

This guide walks you through deploying PrepTalk to GitHub and various hosting platforms.

## 📋 Prerequisites

- GitHub account
- Git installed on your machine
- Node.js 18+ for local testing
- API keys (Gemini)

## 🚀 Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)
```bash
cd your-project-directory
git init
git add .
git commit -m "Initial commit: PrepTalk AI Interview Platform"
```

### 1.2 Create `.gitignore` (Already provided)
Ensure `.gitignore` is in your root directory to exclude:
- `node_modules/`
- `.next/`
- `.env.local`
- `.env.*.local`

### 1.3 Create `.env.example`
This file is already provided — it shows what environment variables are needed without exposing secrets.

## 📤 Step 2: Upload to GitHub

### 2.1 Create a New GitHub Repository
1. Go to [github.com](https://github.com) and log in
2. Click **New** → **New repository**
3. Name it `preptalk` (or your preferred name)
4. Description: "AI Proctored Interview Platform built with Next.js & Gemini"
5. Choose **Public** or **Private**
6. **Do NOT initialize with README** (you have one already)
7. Click **Create repository**

### 2.2 Push Your Code to GitHub
```bash
# Add GitHub as remote
git remote add origin https://github.com/yourusername/preptalk.git

# Rename branch to main (if using master)
git branch -M main

# Push code
git push -u origin main
```

> Replace `yourusername` with your actual GitHub username

## ✅ Step 3: Files to Upload

### ✅ **DO UPLOAD** (Required for deployment)

```
✅ app/                          # All Next.js pages & API routes
✅ components/                   # All React components
✅ lib/                          # Utility functions & hooks
✅ styles/                       # CSS files
✅ public/                       # Static assets (if any)
✅ package.json                  # Dependencies list
✅ package-lock.json             # Dependency lock file
✅ tsconfig.json                 # TypeScript config
✅ next.config.js                # Next.js config
✅ tailwind.config.js            # TailwindCSS config
✅ postcss.config.js             # PostCSS config
✅ README.md                     # Project documentation
✅ .gitignore                    # Git ignore rules
✅ .env.example                  # Environment template
✅ LICENSE                       # License file (if applicable)
```

### ❌ **DO NOT UPLOAD** (Automatically excluded by .gitignore)

```
❌ node_modules/                 # Installed by npm install
❌ .next/                        # Build artifacts
❌ .env.local                    # Your actual API keys
❌ .env.*.local                  # Local environment files
❌ .DS_Store                     # macOS system files
❌ Thumbs.db                     # Windows system files
❌ *.log                         # Log files
❌ .vscode/                      # Editor settings (optional)
❌ .idea/                        # IDE files (optional)
```

## 🔑 Step 4: Configure Deployment

### For Vercel (Recommended)

1. **Connect Vercel to GitHub**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Click "Import Git Repository"
   - Authorize Vercel to access your GitHub
   - Select your `preptalk` repository

2. **Vercel auto-detects Next.js configuration**
   - Build Command: `next build` ✓ (auto-detected)
   - Output Directory: `.next` ✓ (auto-detected)

3. **Add Environment Variables**
   - Click **Settings** → **Environment Variables**
   - Key: `GEMINI_API_KEY`
   - Value: Your actual API key
   - Click **Save**

4. **Deploy**
   - Click **Deploy**
   - Your site will be live in ~2-3 minutes
   - Get a URL like: `https://preptalk-xyz.vercel.app`

### For GitHub Pages

GitHub Pages works with static sites, but PrepTalk is a Next.js dynamic app, so it's not ideal. Use Vercel instead.

### For Other Platforms (AWS, Netlify, Railway, etc.)

Each platform has specific Next.js deployment instructions, but generally:

1. Connect your GitHub repository
2. Ensure Node.js 18+ is available
3. Set environment variables in platform dashboard
4. Vercel auto-configures; other platforms may need:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: 18.17.0+

## 🔐 Step 5: Security Checklist

- [ ] `.env.local` is in `.gitignore` (verify with `git status`)
- [ ] `.env.example` is uploaded (shows structure without secrets)
- [ ] No API keys appear in any committed files
- [ ] Repository is set to **Private** if handling sensitive data
- [ ] API key is set in deployment platform's environment variables
- [ ] HTTPS is enabled (Vercel does this automatically)

## 📊 Step 6: Verify Deployment

1. **Visit your deployed URL**
2. **Test the application**
   - Can you load the landing page?
   - Can you input a job description?
   - Can you start an interview session?
3. **Check console for errors** (F12 → Console tab)
4. **Monitor logs in deployment platform dashboard**

## 🆘 Troubleshooting Deployment

### ❌ "Build failed"
**Solution**: 
- Check the build logs in your deployment platform
- Ensure all TypeScript errors are resolved: `npm run lint`
- Run locally: `npm run build` to test

### ❌ "Gemini API not working"
**Solution**:
- Verify API key is correct in environment variables
- Check it's the actual API key, not a project ID
- Ensure API quotas aren't exceeded

### ❌ "Webcam/audio not working"
**Solution**:
- These require HTTPS (automatic on Vercel)
- Chrome or Edge browser required
- User must grant permission when prompted

### ❌ "Site is very slow"
**Solution**:
- First deployment may be slow; refresh after 1-2 minutes
- Check Vercel Analytics dashboard
- Ensure you're not making excessive API calls

## 📈 Next Steps After Deployment

1. **Add a GitHub Actions workflow** (optional) for automated testing
2. **Set up CI/CD** to automatically redeploy on code changes
3. **Monitor performance** with Vercel Analytics or similar tools
4. **Collect feedback** from early users
5. **Update README** with your actual deployed URL

## 📞 Support

If deployment fails:
1. Check platform-specific documentation (Vercel, AWS, etc.)
2. Review deployment logs carefully
3. Create a GitHub issue for debugging
4. Verify all files are committed with `git status`

---

**Your PrepTalk application is now ready for the world! 🚀**
=======
# Deployment Guide for PrepTalk

This guide walks you through deploying PrepTalk to GitHub and various hosting platforms.

## 📋 Prerequisites

- GitHub account
- Git installed on your machine
- Node.js 18+ for local testing
- API keys (Gemini)

## 🚀 Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)
```bash
cd your-project-directory
git init
git add .
git commit -m "Initial commit: PrepTalk AI Interview Platform"
```

### 1.2 Create `.gitignore` (Already provided)
Ensure `.gitignore` is in your root directory to exclude:
- `node_modules/`
- `.next/`
- `.env.local`
- `.env.*.local`

### 1.3 Create `.env.example`
This file is already provided — it shows what environment variables are needed without exposing secrets.

## 📤 Step 2: Upload to GitHub

### 2.1 Create a New GitHub Repository
1. Go to [github.com](https://github.com) and log in
2. Click **New** → **New repository**
3. Name it `preptalk` (or your preferred name)
4. Description: "AI Proctored Interview Platform built with Next.js & Gemini"
5. Choose **Public** or **Private**
6. **Do NOT initialize with README** (you have one already)
7. Click **Create repository**

### 2.2 Push Your Code to GitHub
```bash
# Add GitHub as remote
git remote add origin https://github.com/yourusername/preptalk.git

# Rename branch to main (if using master)
git branch -M main

# Push code
git push -u origin main
```

> Replace `yourusername` with your actual GitHub username

## ✅ Step 3: Files to Upload

### ✅ **DO UPLOAD** (Required for deployment)

```
✅ app/                          # All Next.js pages & API routes
✅ components/                   # All React components
✅ lib/                          # Utility functions & hooks
✅ styles/                       # CSS files
✅ public/                       # Static assets (if any)
✅ package.json                  # Dependencies list
✅ package-lock.json             # Dependency lock file
✅ tsconfig.json                 # TypeScript config
✅ next.config.js                # Next.js config
✅ tailwind.config.js            # TailwindCSS config
✅ postcss.config.js             # PostCSS config
✅ README.md                     # Project documentation
✅ .gitignore                    # Git ignore rules
✅ .env.example                  # Environment template
✅ LICENSE                       # License file (if applicable)
```

### ❌ **DO NOT UPLOAD** (Automatically excluded by .gitignore)

```
❌ node_modules/                 # Installed by npm install
❌ .next/                        # Build artifacts
❌ .env.local                    # Your actual API keys
❌ .env.*.local                  # Local environment files
❌ .DS_Store                     # macOS system files
❌ Thumbs.db                     # Windows system files
❌ *.log                         # Log files
❌ .vscode/                      # Editor settings (optional)
❌ .idea/                        # IDE files (optional)
```

## 🔑 Step 4: Configure Deployment

### For Vercel (Recommended)

1. **Connect Vercel to GitHub**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Click "Import Git Repository"
   - Authorize Vercel to access your GitHub
   - Select your `preptalk` repository

2. **Vercel auto-detects Next.js configuration**
   - Build Command: `next build` ✓ (auto-detected)
   - Output Directory: `.next` ✓ (auto-detected)

3. **Add Environment Variables**
   - Click **Settings** → **Environment Variables**
   - Key: `GEMINI_API_KEY`
   - Value: Your actual API key
   - Click **Save**

4. **Deploy**
   - Click **Deploy**
   - Your site will be live in ~2-3 minutes
   - Get a URL like: `https://preptalk-xyz.vercel.app`

### For GitHub Pages

GitHub Pages works with static sites, but PrepTalk is a Next.js dynamic app, so it's not ideal. Use Vercel instead.

### For Other Platforms (AWS, Netlify, Railway, etc.)

Each platform has specific Next.js deployment instructions, but generally:

1. Connect your GitHub repository
2. Ensure Node.js 18+ is available
3. Set environment variables in platform dashboard
4. Vercel auto-configures; other platforms may need:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: 18.17.0+

## 🔐 Step 5: Security Checklist

- [ ] `.env.local` is in `.gitignore` (verify with `git status`)
- [ ] `.env.example` is uploaded (shows structure without secrets)
- [ ] No API keys appear in any committed files
- [ ] Repository is set to **Private** if handling sensitive data
- [ ] API key is set in deployment platform's environment variables
- [ ] HTTPS is enabled (Vercel does this automatically)

## 📊 Step 6: Verify Deployment

1. **Visit your deployed URL**
2. **Test the application**
   - Can you load the landing page?
   - Can you input a job description?
   - Can you start an interview session?
3. **Check console for errors** (F12 → Console tab)
4. **Monitor logs in deployment platform dashboard**

## 🆘 Troubleshooting Deployment

### ❌ "Build failed"
**Solution**: 
- Check the build logs in your deployment platform
- Ensure all TypeScript errors are resolved: `npm run lint`
- Run locally: `npm run build` to test

### ❌ "Gemini API not working"
**Solution**:
- Verify API key is correct in environment variables
- Check it's the actual API key, not a project ID
- Ensure API quotas aren't exceeded

### ❌ "Webcam/audio not working"
**Solution**:
- These require HTTPS (automatic on Vercel)
- Chrome or Edge browser required
- User must grant permission when prompted

### ❌ "Site is very slow"
**Solution**:
- First deployment may be slow; refresh after 1-2 minutes
- Check Vercel Analytics dashboard
- Ensure you're not making excessive API calls

## 📈 Next Steps After Deployment

1. **Add a GitHub Actions workflow** (optional) for automated testing
2. **Set up CI/CD** to automatically redeploy on code changes
3. **Monitor performance** with Vercel Analytics or similar tools
4. **Collect feedback** from early users
5. **Update README** with your actual deployed URL

## 📞 Support

If deployment fails:
1. Check platform-specific documentation (Vercel, AWS, etc.)
2. Review deployment logs carefully
3. Create a GitHub issue for debugging
4. Verify all files are committed with `git status`

---

**Your PrepTalk application is now ready for the world! 🚀**
>>>>>>> 2971d9ebc80599e70654021a2d5fdaea23e9e6ce
