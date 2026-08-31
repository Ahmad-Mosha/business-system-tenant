# Build from the repo root — npm workspaces need the root lockfile:
#   docker build -f apps/web/Dockerfile -t prime-web .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
RUN npm run build --workspace=@prime/web

# `output: 'standalone'` in next.config.ts produces a self-contained server —
# a copy of only the node_modules actually used, mirroring the monorepo path
# (apps/web/server.js), not the full workspace install. Verified by building
# locally and inspecting .next/standalone before writing this stage.
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
