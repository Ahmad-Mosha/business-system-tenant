# Multi-arch: builds on x86 and on the ARM instances the free tiers hand out.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci
COPY apps/api apps/api
RUN npm run build -w @prime/api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations ship with the image so a deploy can apply them before starting.
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
