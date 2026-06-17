# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app

# openssl is required by Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Placeholders so `prisma generate` + `next build` run without real secrets
ENV DATABASE_URL="file:./dev.db"
ENV NEXTAUTH_SECRET="build-time-placeholder"
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copy the built app (incl. node_modules + prisma CLI for migrations)
COPY --from=build /app ./

EXPOSE 3000

# On start: ensure the schema is applied, then run the server.
# Provide DATABASE_URL, NEXTAUTH_URL and NEXTAUTH_SECRET at runtime.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start -- -p ${PORT:-3000}"]
