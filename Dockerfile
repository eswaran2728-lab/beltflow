# BeltFlow server: the API plus the web client and legal pages it serves.
#
# Build:  docker build -t beltflow .
# Run:    docker run -p 4000:4000 --env-file server/.env beltflow
# In production the server refuses to start until its configuration is
# complete (see server/.env.example and server/src/config/validateEnv.ts).

# ---- 1. Compile the TypeScript server --------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ---- 2. Runtime image: production dependencies only -------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./dist

# The web client and legal pages, at the paths the server serves them from
# (the repository root, one level above server/).
COPY index.html manifest.json sw.js support.js /app/
COPY assets /app/assets
COPY legal /app/legal
COPY .well-known /app/.well-known

# Uploaded media lives on a mounted disk (MEDIA_STORAGE_DIR); make sure the
# unprivileged user can write to the default location too.
RUN mkdir -p /app/server/.storage /var/data && chown -R node:node /app/server/.storage /var/data

USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
