# Build and run only the live-csv-server (for Railway).
# REQUIRED: In Railway Service → Settings, set Root Directory = live-csv-server
# (Build context is the live-csv-server folder, so paths are relative to it.)
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
