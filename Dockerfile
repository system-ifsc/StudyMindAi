FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_BACKEND=local
ENV VITE_SUPABASE_URL="" VITE_SUPABASE_PUBLISHABLE_KEY=""
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 VITE_BACKEND=local LOCAL_DATA_DIR=/app/data
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
