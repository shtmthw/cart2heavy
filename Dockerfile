# syntax=docker/dockerfile:1.7
#
# One image: the Express API that also serves the built React app.
#
# Every stage that RUNs something is pinned to the machine doing the build ($BUILDPLATFORM) and
# the final stage has no RUN at all, so a linux/amd64 + linux/arm64 image can be built without
# CPU emulation (the build output and the production dependencies are plain JavaScript).

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.15.0

# ---------------------------------------------------------------------------- base
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN npm install --global "pnpm@${PNPM_VERSION}" && npm cache clean --force
# the test-only MongoDB download is not needed to build the app
ENV MONGOMS_DISABLE_POSTINSTALL=1 \
    CI=true
WORKDIR /repo

# only the package manifests: this layer (and the install below) stays cached until a dependency changes
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# ---------------------------------------------------------------------------- build
FROM manifests AS build
RUN --mount=type=cache,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/api apps/api
RUN pnpm --filter @cart2heavy/web build \
 && pnpm --filter @cart2heavy/api build

# ------------------------------------------------------------- production dependencies
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/pnpm-store \
    pnpm --filter @cart2heavy/api deploy --prod --store-dir /pnpm-store /deploy

# an empty uploads folder that belongs to the unprivileged "node" user (uid 1000)
FROM base AS skeleton
RUN mkdir -p /skeleton/uploads && chown 1000:1000 /skeleton/uploads

# ---------------------------------------------------------------------------- runtime
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    UPLOAD_DIR=/app/uploads \
    WEB_DIST=/app/web \
    SEED_IMAGES_DIR=/app/seed-images
WORKDIR /app

COPY --from=prod-deps /deploy/package.json ./package.json
COPY --from=prod-deps /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/web/dist ./web
COPY --from=build /repo/apps/api/src/seed/images ./seed-images
COPY --from=skeleton --chown=node:node /skeleton/uploads ./uploads

USER node
EXPOSE 8080
VOLUME ["/app/uploads"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]
