FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test && mkdir -p /data && chown bun:bun /data
ENV DB_PATH=/data/mantenimiento.db PORT=3005
USER bun
EXPOSE 3005
CMD ["bun", "run", "index.ts"]
