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

## 4. Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

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
4. **Redeploy backend** after `.env` changes: `./deploy.sh`
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
./deploy.sh
```

Back up Postgres:

```bash
docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "medusa-$(date +%F).sql.gz"
```

The Compose services use `restart: unless-stopped`, so they return after a VPS
reboot.
