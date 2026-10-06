# PESO Localhost

This version keeps the existing PESO features and design. It is set up for browser-based local/live viewing only.

## Easiest way

1. Install Node.js LTS.
2. Double-click `start-localhost.bat`.
3. Open `http://localhost:3001`.

The launcher installs dependencies, generates Prisma, updates the local SQLite database, builds the existing React frontend, and starts the Express server.

## Development mode

Use `start-dev.bat` if you want Vite hot reload. The client is available at `http://localhost:5173`, and `/api` is proxied to the backend on port 3001.

## Live viewing on another device

Connect the device to the same Wi-Fi as the computer running PESO, then open `http://<PC-IPv4-address>:3001`. Windows Firewall may ask for permission; allow Node.js on Private networks.
