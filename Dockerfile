# Giftify wrapper: پروژه داخل Giftify.zip است و موقع بیلد باز می‌شود
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl unzip
COPY Giftify.zip /tmp/Giftify.zip
RUN unzip -q /tmp/Giftify.zip -d /tmp/x && cp -a /tmp/x/Giftify/. /app/ && rm -rf /tmp/x /tmp/Giftify.zip
RUN npm install --no-audit --no-fund
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/db/giftify.db"
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/db/giftify.db"
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/db
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npm start"]
