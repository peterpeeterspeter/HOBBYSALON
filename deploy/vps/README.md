# Hobbysalon Backend on Ubuntu VPS

This stack runs Medusa permanently on the RackNerd Ubuntu 24.04 VPS using
Docker Compose. It integrates with the server's existing Nginx installation.

## 1. Configure DNS

Create an `A` record:

```text
api.hobbysalon.be -> YOUR_VPS_IPV4
```

Do not use the RackNerd test IP shown for the location. Use the VPS's assigned
public IPv4 address from the RackNerd control panel.

## 2. Prepare Ubuntu

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

Log out and back in after adding the Docker group.

## 3. Clone and configure

```bash
sudo mkdir -p /opt/hobbysalon
sudo chown "$USER":"$USER" /opt/hobbysalon
git clone https://github.com/peterpeeterspeter/HOBBYSALON.git /opt/hobbysalon
cd /opt/hobbysalon/deploy/vps
cp .env.example .env
chmod 600 .env
```

Edit `.env` and replace every placeholder. Generate secrets with:

```bash
openssl rand -hex 32
```

## 4. Approved backend-only deploy

Prepare the reviewed checkout separately; `deploy.sh` never pulls Git. Approval
must name the full, exact 40-character HEAD and all tracked source must be clean.
Run with sufficient privileges for the existing Nginx installation:

```bash
cd /opt/hobbysalon/deploy/vps
export EXPECTED_COMMIT='<full reviewed commit SHA>'
export DEPLOY_APPROVED=true
export COMMERCE_PAYMENTS_ENABLED=false COMMERCE_PAYOUTS_ENABLED=false
bash ./deploy.sh /opt/hobbysalon
```

`EXPECTED_COMMIT` must also remain set for subsequent Compose commands (the
backend image tag is commit-specific). This is not a first-install bootstrap:
**existing PostgreSQL and Redis containers must already be running and healthy**.
Provisioning dependencies requires its own approval. In particular, production
has PostgreSQL 16: the manifest's PostgreSQL 17 declaration must not be used to
recreate that service or mount its data volume into version 17. This script uses
backend-only `--no-deps --no-build --wait --wait-timeout 300`, never whole-stack
`up`. Do not run an unqualified `docker compose up -d` for an update.

Preflight checks approval, commit, clean tracked source, required commands,
Compose configuration/wait support, existing Nginx configuration and dependency
health before building. Application gitlinks/submodules in the approved commit
are refused: their contents are not supplied by `git archive`. Only unquoted
gitlink paths under `.claude/` are allowed; the entire `.claude` agent-metadata
directory is explicitly excluded during archive extraction (`tar --exclude=.claude`),
including tracked files and benign agent-worktree gitlinks. Quoted unusual
gitlink paths and lookalike prefixes such as `.claude-app/` fail conservatively.
Nothing in the live `.claude` directory or Git index is changed. The build context is
an isolated `mktemp` directory outside the checkout, populated only by
`git archive --format=tar "$EXPECTED_COMMIT" | tar ...`; Docker builds its archived
backend Dockerfile with the exact commit tag and revision label. Untracked or
ignored backend source, operator `.env` files and `.git` metadata from the live
checkout never enter this context. Temporary context cleanup runs on successful
and failed exits (and handled INT/TERM); SIGKILL cannot run shell traps.
It verifies the commit label and
image ID, waits at most 300 seconds for backend startup, and independently checks
backend health and its exact running image ID **before** installing/reloading
Nginx or running optional Certbot. Build duration is not covered by this startup
timeout. A `compose ps` listing is not success. Any failed stage exits nonzero;
there is no automatic rollback or ingress restoration. If Certbot is absent,
TLS provisioning remains a separate operator task.

Local regression proof (2026-10-04):
`node --max-old-space-size=128 --test scripts/tests/backend-deploy.test.mjs`
executed the actual Bash script with PATH stand-ins for every deploy mutator.
Before the isolated-context implementation: **RED, 27/36 pass, 9 fail**;
afterwards: **GREEN, 36/36 pass**. Logs are outside the checkout at
`/home/hermes/audits/hobbysalon-backend-fixes-20261004/deploy-context-{red,green}.log`.
Two temporary-repository fixtures use real Git commits, `git archive` and tar:
they inspect the context passed to the fake Docker command, proving tracked
source is present, untracked/ignored source and synthetic `.env` secrets are
absent, the commit tag/label and Dockerfile path are exact, and cleanup occurs
both after success and an injected build failure. No real Docker build, Compose
startup, provider call or deployment was performed. This proves input isolation,
not a hermetic/reproducible image build or production release acceptance.

Gitlink-exclusion regression proof:
`node --max-old-space-size=96 --test scripts/tests/backend-deploy.test.mjs`:
**RED, 37/41 pass, 4 fail; GREEN, 41/41 pass**. Logs:
`/home/hermes/audits/hobbysalon-backend-fixes-20261004/context-gitlink-{red,green}.log`.
Temporary real-Git fixtures create `.claude/worktrees/interesting-jepsen`
gitlinks using `git update-index --cacheinfo` and an existing fixture commit.
Success and injected-build-failure cases verify approved application source is
present, `.claude`, untracked/ignored source, synthetic `.env` and `.git` are absent,
and temporary contexts are cleaned. Separate real application, prefix-lookalike
and quoted-path gitlinks must fail before archiving or building. All deployment
mutators remain stand-ins; no production deployment is exercised.

**Commerce remains paused during this rollout.** Both Compose flags default to
`false`; explicit operator values can be used only in a separately approved
activation procedure. `deploy.sh` rejects shell-enabled flags and exports both
as `false`, overriding stale enabled values in `.env`/backend env files without
printing credentials. These flags pause new payment/payout creation, not all
commerce callbacks or read traffic.

### Separate release gates (not performed by deploy.sh)

Before a production invocation, obtain separate approval and evidence for:

- A verified PostgreSQL backup, an isolated restore rehearsal and the exact
  reviewed schema/migration procedure; never infer applied schema from health.
- Legacy commerce acceptance and the coordinated Stripe **test-mode** payment,
  refund, return and payout scenarios; keep real money/provider calls separate.
- A reviewed cutover and recovery plan, including database-major compatibility
  and the previous exact backend image. Backend health is not business acceptance.
- Activation of payments/payouts only after those gates pass, with explicit
  operator-provided flags; this deploy script intentionally cannot activate them.

Permanent execution/reconciliation ledgers are financial evidence: **do not run
migration down, truncate/delete them or restore an old database to undo a deploy**.
Rolling back application code does not roll back irreversible provider effects
or authorize erasure of ledgers. Reconcile uncertain outcomes and use approved
forward repairs separately.

Monitor startup:

```bash
docker compose logs -f backend
```

After DNS resolves, obtain the TLS certificate:

```bash
sudo certbot --nginx -d api.hobbysalon.be
```

Verify:

```bash
curl https://api.hobbysalon.be/health
```

## 5. Connect the Vercel storefront

Set these Production and Preview variables on the Vercel `storefront` project:

```text
MEDUSA_BACKEND_URL=https://api.hobbysalon.be
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.hobbysalon.be
```

Also set `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` after creating or retrieving the
Medusa store publishable API key. Redeploy `storefront`.

For the vendor portal handoff, also set on the storefront project:

```text
VENDOR_PANEL_URL=https://verkoper.hobbysalon.be
```

Deploy the vendor panel per `deploy/verkoper-vercel.md`.

## 6. Production checklist (after first healthy deploy)

Confirm these before cutting over traffic:

1. **DNS** — `api.hobbysalon.be` A record points to the VPS public IPv4 (not an old host).
2. **TLS** — `sudo certbot --nginx -d api.hobbysalon.be`, then `curl https://api.hobbysalon.be/health`.
3. **VPS `.env`** — copy values from `.env.example`, including:
   - `VENDOR_CORS` and `AUTH_CORS` with `https://verkoper.hobbysalon.be`
   - `PLATFORM_SUPABASE_URL`, `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_SUPABASE_ANON_KEY` (seller auth exchange)
   - Stripe, Resend, and real `JWT_SECRET` / `COOKIE_SECRET`
4. **Redeploy backend** after `.env` changes using the full approval command in
   section 4 (a bare `./deploy.sh` is deliberately refused).
5. **Seller auth backfill** (one-time, after platform Supabase env is set):

   ```bash
   docker compose exec backend yarn backfill:seller-auth
   ```

6. **SSH** — use key-based login only; rotate the root password if it was ever shared.

Medusa connects to the private Compose Postgres with `?sslmode=disable` in
`DATABASE_URL` and `DATABASE_SSL=false`. Do not enable SSL for the internal
database network.

## Operations

Deploy updates:

```bash
cd /opt/hobbysalon/deploy/vps
# Repeat the reviewed EXPECTED_COMMIT + DEPLOY_APPROVED + paused flags from section 4.
bash ./deploy.sh /opt/hobbysalon
```

Back up Postgres:

```bash
docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "medusa-$(date +%F).sql.gz"
```

The Compose services use `restart: unless-stopped`, so they return after a VPS
reboot.
