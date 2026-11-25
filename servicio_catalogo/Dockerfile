FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN node ace build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/build ./
RUN npm ci --omit=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3002 LOG_LEVEL=info TZ=UTC
EXPOSE 3002
CMD ["node", "bin/server.js"]
