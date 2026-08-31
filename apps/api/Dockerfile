# Build from the repo root — npm workspaces need the root lockfile:
#   docker build -f apps/api/Dockerfile -t prime-api .
#
# ponytail: both workspaces' deps land in one shared node_modules rather than
# an isolated per-workspace install — simpler, more reliable Dockerfile at the
# cost of a larger image. Split into workspace-scoped installs if image size
# or build time ever actually matters at this app's scale.

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run build --workspace=@prime/api

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev
COPY --from=build /repo/apps/api/dist apps/api/dist

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /repo
USER app

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
