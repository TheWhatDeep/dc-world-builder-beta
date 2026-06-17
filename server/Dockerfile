# Single-container CODEX server. Serves the API and the vanilla frontend.
FROM node:22-slim

# better-sqlite3 / sharp ship prebuilt binaries; no build toolchain needed.
WORKDIR /app

# Install server deps first for layer caching.
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy the frontend (repo root) and the server source.
COPY index.html ./frontend/index.html
COPY css ./frontend/css
COPY js ./frontend/js
COPY server ./server

ENV NODE_ENV=production \
    CODEX_FRONTEND_DIR=/app/frontend \
    CODEX_DATA_DIR=/data \
    CODEX_PORT=8787

VOLUME ["/data"]
EXPOSE 8787

WORKDIR /app/server
CMD ["node", "src/server.js"]
