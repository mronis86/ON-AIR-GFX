# Build and run only the live-csv-server (for Railway).
# Option 1: In Railway Service → Variables, add RAILWAY_DOCKERFILE_PATH = live-csv-server/Dockerfile
# Option 2: In Railway Service → Settings, set Root Directory = live-csv-server
# Using both is safe; build context is repo root, so paths below are relative to root.
FROM node:22-alpine
WORKDIR /app
COPY live-csv-server/package.json ./
RUN npm install --omit=dev
COPY live-csv-server/server.js ./
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
