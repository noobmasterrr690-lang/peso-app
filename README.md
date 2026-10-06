# PESO

PESO (Personal Expense & Spending Organizer) is a lightweight mobile-first budgeting app for students. It helps track expenses, manage a monthly budget, monitor savings goals, and keep an eye on the current balance from a single dashboard.

## Structure

This project uses a small monorepo with separate client and server folders:

- `client/` - Vite + React + Tailwind frontend
- `server/` - Express + Prisma + SQLite backend API
- `server/prisma/schema.prisma` - database schema and models

This layout makes it easy to later swap SQLite for PostgreSQL while keeping the app logic intact.

## Local setup

1. Install dependencies:
   npm install
2. Create a local environment file:
   cp server/.env.example server/.env
   (or copy the file in Windows Explorer / rename it in VS Code)
3. Push the Prisma schema:
   npm run db:push
4. Seed demo data:
   npm run db:seed
5. Start the app:
   npm run dev
   (or double-click run.bat on Windows)

The frontend runs at http://localhost:5173 (or http://127.0.0.1:5173) and the API runs at http://localhost:3001.

## Demo login

Email: student@peso.app  
Password: password123

## Features

- JWT authentication with bcrypt password hashing
- Balance tracking and updates
- Expense logging, filtering, and deletion
- Monthly budget limits with category targets
- Savings goals with progress tracking
- Dashboard summary and spending reports in Philippine pesos (PHP)
- Six-month spending trend review with current-month and previous-month comparison
- Glassmorphism interface with a white, gold, and green visual system
- Responsive front-end tailored for student use

## Scripts

- `npm run dev` - runs the frontend and backend together
- `npm run build` - builds the frontend bundle
- `npm run db:push` - applies Prisma migrations/schema changes
- `npm run db:seed` - populates sample data
- `npm run start` - starts the Express API server only
