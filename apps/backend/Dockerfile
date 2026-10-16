# BuildKit is required for the network-denied compilation step.
# Registry index fetched and retained in the release-worker audit (2026-10-05).
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base

FROM base AS toolchain
# Match packageManager without an unpinned global install. Verify published bytes.
RUN wget -q https://registry.npmjs.org/yarn/-/yarn-1.22.21.tgz -O /tmp/yarn.tgz \
    && printf '%s\n' 'dbed5b7e10c552ba0e1a545c948d5473bc6c5a28ce22a8fd27e493e3e5eb6370  /tmp/yarn.tgz' | sha256sum -c - \
    && mkdir /opt/release-yarn \
    && tar -xzf /tmp/yarn.tgz -C /opt/release-yarn --strip-components=1 \
    && rm /tmp/yarn.tgz
ENV PATH="/opt/release-yarn/bin:${PATH}"

FROM toolchain AS installer
WORKDIR /app
# Preserve the authoritative root lock and manifests byte-for-byte. Do not prune:
# only backend + library workspaces are included; frontend dependencies stay out.
COPY package.json yarn.lock turbo.json ./
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/
COPY deploy/release/ ./deploy/release/
RUN mkdir /release \
    && node deploy/release/audit-dependencies.cjs preflight /app > /release/preflight.json \
    && node deploy/release/audit-dependencies.cjs snapshot /app > /release/source.json \
    && sha256sum /release/source.json | cut -d ' ' -f 1 > /release/source.sha256 \
    && yarn install --production=false --frozen-lockfile --non-interactive \
    && yarn cache clean \
    && node deploy/release/audit-dependencies.cjs unchanged /app /release/source.json \
    && node deploy/release/audit-dependencies.cjs installed /app > /release/dependencies.json

FROM installer AS builder
# No database, migration, seed, provider, server or registry access while compiling.
# Existing manifests already declare turbo, ts-node and TypeScript (lock: 5.9.3).
RUN --network=none CI=true NODE_ENV=development DISABLE_ALGOLIA=true \
    DATABASE_URL=postgres://build:build@127.0.0.1:1/build REDIS_URL= \
    yarn turbo run build --filter=api... --concurrency=1 --force --no-daemon --env-mode=loose \
    && node deploy/release/audit-dependencies.cjs unchanged /app /release/source.json \
    && node deploy/release/audit-dependencies.cjs installed /app > /release/dependencies.json \
    && node deploy/release/archive-runtime.cjs /app /runtime > /release/archive.json

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S -g 1001 medusa && adduser -S -u 1001 -G medusa medusa
# Keep executable code and approval receipt root-owned, not writable by the server.
COPY --from=builder /runtime/ /app/
COPY --from=builder /release/ /release/
COPY apps/backend/entrypoint.sh /usr/local/bin/release-entrypoint
RUN chmod 0555 /usr/local/bin/release-entrypoint \
    && mkdir -p /app/apps/backend/static \
    && chown medusa:medusa /app/apps/backend/static \
    && ln -s /app/apps/backend/static /app/apps/backend/.medusa/server/static
USER medusa
WORKDIR /app/apps/backend/.medusa/server
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e 'const h=require("node:http");const r=h.get({host:"127.0.0.1",port:process.env.PORT||9000,path:"/health"},s=>{s.resume();process.exit(s.statusCode===200?0:1)});r.on("error",()=>process.exit(1));r.setTimeout(4000,()=>{r.destroy();process.exit(1)})'
ENTRYPOINT ["/usr/local/bin/release-entrypoint"]
CMD ["start"]
