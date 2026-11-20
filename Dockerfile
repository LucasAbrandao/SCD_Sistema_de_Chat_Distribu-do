FROM node:22.19.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/chat/package.json services/chat/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY . .
RUN npm run build
FROM build AS auth
CMD ["node", "services/auth/dist/index.js"]
FROM build AS chat
CMD ["node", "services/chat/dist/index.js"]
FROM nginx:1.28.0-alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
