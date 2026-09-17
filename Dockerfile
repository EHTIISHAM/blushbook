# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Blushbook production image
#
# IMPORTANT: NEXT_PUBLIC_* values are compiled into the browser bundle during
# `next build`, not read when the container starts. They must be supplied as
# build arguments as well as runtime environment variables. Changing one means
# rebuilding the image, not just restarting it. See DEPLOY.md.
# ---------------------------------------------------------------------------

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app


# --- dependencies ----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# --- build -----------------------------------------------------------------
FROM base AS builder

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Fail the build here rather than shipping an image whose browser bundle has
# an empty Supabase URL baked in and only breaks once a tech tries to log in.
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then \
      echo "ERROR: NEXT_PUBLIC_SUPABASE_URL build arg is required"; exit 1; \
    fi; \
    if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then \
      echo "ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY build arg is required"; exit 1; \
    fi; \
    if [ -z "$NEXT_PUBLIC_SITE_URL" ]; then \
      echo "ERROR: NEXT_PUBLIC_SITE_URL build arg is required"; exit 1; \
    fi

RUN npm run build


# --- runtime ---------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `output: "standalone"` emits a server with its own trimmed node_modules, but
# it does not copy these two — they have to come across by hand.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
