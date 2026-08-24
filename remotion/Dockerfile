FROM node:24-bookworm-slim

# Chrome's runtime libraries. Remotion ships its own headless shell but not the system libs it
# links against, and a missing one fails at render time with a bare exit code rather than a
# message that says which.
RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 \
  libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
  libpango-1.0-0 libcairo2 libcups2 ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* tsconfig.json remotion.config.ts ./
COPY src ./src

RUN npm ci --omit=dev || npm install --omit=dev

# Both baked into the image, not fetched at render time: a container that downloads Chrome on
# first request pays that cost on a cold start, and a bundle built per render would make every
# clip wait on a webpack build.
RUN npx remotion browser ensure
RUN npx remotion bundle --out-dir=build

CMD ["node", "src/server.ts"]
