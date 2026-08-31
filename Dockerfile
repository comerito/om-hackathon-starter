FROM node:24-alpine AS builder

# Node caps its default old-space at ~2.2GB regardless of how much memory the host
# offers (verified: still 2240MB in a container given 8GB). The Next production build
# of this app exceeds that and dies with
#   FATAL ERROR: Ineffective mark-compacts near heap limit - JavaScript heap out of memory
# so the limit has to be raised explicitly for the build stage.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096

WORKDIR /app

RUN apk add --no-cache python3 make g++ ca-certificates openssl
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY . .
RUN yarn generate
ENV NODE_ENV=production
RUN yarn build

FROM node:24-alpine AS dev

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache python3 make g++ ca-certificates openssl
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY . .

COPY docker/scripts/dev-entrypoint.sh /app/docker/scripts/dev-entrypoint.sh
RUN chmod +x /app/docker/scripts/dev-entrypoint.sh

EXPOSE 3000
CMD ["/bin/sh", "/app/docker/scripts/dev-entrypoint.sh"]

FROM node:24-alpine AS runner

ARG CONTAINER_PORT=3000

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=${CONTAINER_PORT}

WORKDIR /app

RUN apk add --no-cache ca-certificates openssl
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
# `yarn install --production=true` is Yarn 1 syntax. This project pins
# `packageManager: yarn@4.12.0`, so corepack runs Yarn 4, which rejects the flag:
#   Unknown Syntax Error: Invalid option name ("--production=true")
# The Yarn 4 equivalent is `workspaces focus --production` (bundled plugin).
RUN yarn workspaces focus --production

COPY --from=builder /app/.mercato/next ./.mercato/next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/types ./types
COPY --from=builder /app/.mercato ./.mercato
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/components.json ./components.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN adduser -D -u 1001 omuser \
 && chown -R omuser:omuser /app

USER omuser

EXPOSE ${CONTAINER_PORT}
CMD ["yarn", "start"]
