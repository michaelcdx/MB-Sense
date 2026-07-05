# MBSense DigitalOcean Droplet Deployment

This guide deploys MBSense on a DigitalOcean Droplet using Docker Compose, Nginx, HTTPS, and your domain:

```txt
mbsense.online
www.mbsense.online
```

## 1. Create the Droplet

Recommended starting Droplet:

```txt
Image: Ubuntu 24.04 LTS
Plan: Basic
Size: 2 GB RAM minimum recommended for Docker builds
Authentication: SSH key
Region: closest to your users
```

You can also choose DigitalOcean's Docker Marketplace image. If you use a normal Ubuntu image, install Docker in step 4.

## 2. Point the Domain to the Droplet

In your DNS provider, create these records:

```txt
Type   Name   Value
A      @      YOUR_DROPLET_IP
A      www    YOUR_DROPLET_IP
```

If you manage DNS inside DigitalOcean, add `mbsense.online` in DigitalOcean Networking > Domains, then create the same `A` records there.

Wait for DNS to propagate before HTTPS setup:

```bash
nslookup mbsense.online
nslookup www.mbsense.online
```

Both should return your Droplet IP.

## 3. SSH Into the Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

Update the server:

```bash
apt update
apt upgrade -y
```

Install base tools:

```bash
apt install -y git nginx certbot python3-certbot-nginx ufw ca-certificates curl
```

## 4. Install Docker

Skip this step if your Droplet already has Docker installed.

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Verify Docker Compose:

```bash
docker compose version
```

## 5. Configure the Firewall

Allow SSH, HTTP, and HTTPS:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

If you use DigitalOcean Cloud Firewalls, allow inbound:

```txt
22/tcp
80/tcp
443/tcp
```

Do not publicly allow `8000` or `8080`; Docker Compose binds those ports to `127.0.0.1`, and Nginx proxies to them locally.

## 6. Upload or Clone the Project

Recommended path:

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git mbsense
cd /opt/mbsense
```

If the repo is private, use a GitHub deploy key, GitHub CLI, or upload the project with `scp`.

## 7. Create the Production Environment File

Create only one deployment env file at the repo root:

```bash
nano .env
```

Use this template:

```env
NODE_ENV=production
PORT=8000
APP_URL=https://mbsense.online

# Required for the chatbot and AI endpoints.
GEMINI_API_KEY=your_gemini_api_key_here

# Recommended for live EV charger lookup. Use this key name.
OPEN_CHARGE_MAP_API_KEY=your_open_charge_map_api_key_here

# Required for the Map page basemap and geocoding.
VITE_MAPTILER_API_KEY=your_maptiler_api_key_here

# Optional: only needed for Google Places autocomplete in Calendar.
GOOGLE_MAPS_PLATFORM_KEY=
VITE_GOOGLE_MAPS_PLATFORM_KEY=
VITE_GOOGLE_MAPS_KEY=

# Optional: only use this older alias instead of OPEN_CHARGE_MAP_API_KEY.
OCM_API_KEY=
```

Important:

- Do not commit `.env`.
- For Droplet deployment, `docker-compose.yml` reads the root `.env` and passes it to the backend container.
- `backend/.env` is only useful for local development when running the backend manually from the `backend` folder.
- `OPEN_CHARGE_MAP_API_KEY` and `OCM_API_KEY` overlap. Prefer `OPEN_CHARGE_MAP_API_KEY`; leave `OCM_API_KEY` empty unless you specifically want to use the alias.
- Google Maps keys are optional. Without them, the app still runs, but Calendar Google Places autocomplete is unavailable.
- Frontend `VITE_*` values are baked into the frontend image during build. If you change them later, rebuild the frontend container.
- If Google Maps API key restrictions are enabled, allow `https://mbsense.online/*` and `https://www.mbsense.online/*`.

## 8. Build and Start the App

The existing `docker-compose.yml` starts:

- backend API on container port `8000`, bound to `127.0.0.1:8000`
- frontend Nginx on container port `80`, bound to `127.0.0.1:8080`
- frontend Nginx proxies `/api` and `/live` to the backend container

Run:

```bash
docker compose up -d --build
```

Check containers:

```bash
docker compose ps
```

Check backend health:

```bash
curl http://127.0.0.1:8000/api/health
```

Check frontend:

```bash
curl -I http://127.0.0.1:8080
```

View logs:

```bash
docker compose logs -f
```

## 9. Configure Public Nginx Reverse Proxy

This repo includes the public Nginx config at:

```txt
deploy/nginx/mbsense.online.conf
```

Copy it into Nginx:

```bash
cp /opt/mbsense/deploy/nginx/mbsense.online.conf /etc/nginx/sites-available/mbsense.online
```

The config proxies public traffic to the frontend Docker container on `127.0.0.1:8080` and includes WebSocket headers for `/live`:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name mbsense.online www.mbsense.online;

  client_max_body_size 20m;

  location /live {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
  }
}
```

Enable the site:

```bash
ln -sf /etc/nginx/sites-available/mbsense.online /etc/nginx/sites-enabled/mbsense.online
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Test HTTP:

```bash
curl -I http://mbsense.online
curl http://mbsense.online/api/health
```

## 10. Enable HTTPS

Run Certbot:

```bash
certbot --nginx -d mbsense.online -d www.mbsense.online
```

Choose the redirect option if Certbot asks whether to redirect HTTP to HTTPS.

Verify:

```bash
curl -I https://mbsense.online
curl https://mbsense.online/api/health
```

Check auto-renewal:

```bash
systemctl status certbot.timer
certbot renew --dry-run
```

## 11. Updating the App

After pushing new code to GitHub:

```bash
cd /opt/mbsense
git pull
docker compose up -d --build
docker image prune -f
```

Check logs after every update:

```bash
docker compose logs --tail=100
```

## 12. Useful Commands

Restart app:

```bash
cd /opt/mbsense
docker compose restart
```

Stop app:

```bash
cd /opt/mbsense
docker compose down
```

Rebuild only frontend:

```bash
cd /opt/mbsense
docker compose build frontend
docker compose up -d frontend
```

Rebuild only backend:

```bash
cd /opt/mbsense
docker compose build backend
docker compose up -d backend
```

Watch backend logs:

```bash
cd /opt/mbsense
docker compose logs -f backend
```

Watch frontend logs:

```bash
cd /opt/mbsense
docker compose logs -f frontend
```

## 13. Troubleshooting

### Domain does not open

Check DNS:

```bash
nslookup mbsense.online
```

Check Nginx:

```bash
nginx -t
systemctl status nginx
```

### 502 Bad Gateway

The frontend container may not be running.

```bash
cd /opt/mbsense
docker compose ps
docker compose logs --tail=100
curl -I http://127.0.0.1:8080
```

### Chatbot does not respond

Check the backend and Gemini key:

```bash
cd /opt/mbsense
docker compose logs --tail=100 backend
curl https://mbsense.online/api/health
```

Confirm `GEMINI_API_KEY` is set in the root `.env` without printing the secret:

```bash
test -n "$(grep -E '^GEMINI_API_KEY=.+$' .env | cut -d= -f2-)" && echo "GEMINI_API_KEY is set"
```

### Live charging stations do not load

Confirm `OPEN_CHARGE_MAP_API_KEY` exists in the root `.env`:

```bash
test -n "$(grep -E '^OPEN_CHARGE_MAP_API_KEY=.+$' .env | cut -d= -f2-)" && echo "OPEN_CHARGE_MAP_API_KEY is set"
```

If you change the key, rebuild and restart the backend:

```bash
cd /opt/mbsense
docker compose up -d --build backend
```

### Map does not load

Confirm `VITE_MAPTILER_API_KEY` exists in the root `.env`, then rebuild:

```bash
cd /opt/mbsense
docker compose up -d --build frontend
```

### Voice or live socket fails

Confirm `/live` is passing WebSocket upgrade headers:

```bash
nginx -T | grep -A20 "location /live"
```

Then check frontend and backend logs:

```bash
cd /opt/mbsense
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
```

## 14. References

- DigitalOcean Droplets: https://docs.digitalocean.com/products/droplets/
- DigitalOcean DNS: https://docs.digitalocean.com/products/networking/dns/
- Docker Engine on Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Certbot Nginx: https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal