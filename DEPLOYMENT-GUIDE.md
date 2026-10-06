# Sharing PESO With Friends: Free Permanent Cloud Deployment Guide

This guide walks you through deploying **PESO** to the cloud for free using **GitHub + Neon (Postgres) + Render**. Once deployed, your friends can use it 24/7 on mobile and desktop from anywhere with no setup on their end.

---

## 3 Quick Steps Overview
1. **GitHub**: Push your code to a free GitHub repository.
2. **Neon**: Create a free PostgreSQL database (takes 30 seconds).
3. **Render**: Connect your GitHub repository and paste your database link.

---

## Step 1: Create a GitHub Repository & Push Your Code

1. Open [github.com/new](https://github.com/new) in your browser.
2. Under **Repository name**, enter: `peso-app`.
3. Choose **Public** (or **Private**).
4. Leave **Add a README file**, **Add .gitignore**, and **Choose a license** **UNCHECKED** (we already created them for you).
5. Click **Create repository**.
6. Copy the repository URL (e.g., `https://github.com/YOUR_USERNAME/peso-app.git`).
7. In your `peso-app` folder on your computer:
   - Double-click **`push-to-github.bat`**.
   - Paste your GitHub URL and press **Enter**.
   - A browser window may open asking you to sign in with GitHub — approve it.
   - When it says `[SUCCESS]`, your code is on GitHub!

*(Alternatively in terminal):*
```powershell
cd peso-app
git remote add origin https://github.com/YOUR_USERNAME/peso-app.git
git branch -M main
git push -u origin main
```

---

## Step 2: Get a Free Cloud Database on Neon

Render's free tier has ephemeral storage, so SQLite files would reset on server sleep. Neon gives you a permanently free, serverless PostgreSQL database:

1. Go to [neon.tech](https://neon.tech) and sign up with your GitHub account (Free).
2. Click **Create Project**.
3. Name it `peso-db` and select the region closest to you (e.g. `Singapore` or `US East`).
4. Click **Create project**.
5. On the dashboard, you will see **Connection string**.
6. Ensure it says **Postgres** and copy the URL. It looks like:
   ```text
   postgresql://kier:abc123xyz@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this copied for Step 3).*

---

## Step 3: Deploy on Render

1. Go to [render.com](https://render.com) and sign up/sign in with your GitHub account.
2. Click **New +** at the top right, then select **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Choose your `peso-app` repository and click **Connect**.
5. Fill in the details:
   - **Name**: `peso-app` (or any name you want)
   - **Region**: Choose the region closest to you / your Neon database
   - **Branch**: `main`
   - **Root Directory**: leave blank (or `peso-app` if you pushed the parent folder)
   - **Runtime**: `Node`
   - **Build Command**: `npm install --include=dev && npm run deploy:build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free`
6. Scroll down to **Environment Variables** and add:
   - **Key**: `DATABASE_URL`
     - **Value**: *(Paste your Neon database connection string from Step 2)*
   - **Key**: `JWT_SECRET`
     - **Value**: *(Any long random text, e.g. `peso-secure-secret-2026-key`)*
   - **Key**: `NODE_ENV`
     - **Value**: `production`
7. Click **Deploy Web Service**!

---

## What Happens During Deployment?
- Render automatically installs dependencies.
- Our automatic `prepare-db.js` script detects your PostgreSQL database, generates the Prisma client for Linux, and pushes all tables (`User`, `Expense`, `Income`, `Budget`, `SavingsGoal`).
- Vite compiles the React frontend.
- Express starts and serves both your API and your React app on `https://peso-app-xxxx.onrender.com`.

---

## Sharing With Friends
Once Render finishes building (usually 2-3 minutes), you will see your live public URL at the top:
👉 `https://peso-app-xxxx.onrender.com`

Send that link to your friends! They can:
- Open it on their phones (iOS Safari, Android Chrome) or PC.
- Create their own accounts.
- Track their daily allowance, expenses, budgets, and savings goals with the animated Peso coin mascot!
