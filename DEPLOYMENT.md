# EC2 Docker deployment

The application runs as four containers:

- `frontend`: React static build served by Nginx on port 80
- `backend`: Node/Express API (internal port 5000)
- `ai-service`: Flask/Gunicorn AI API (internal port 5001)
- `database`: MySQL 8.4

The SAM checkpoint is deliberately **not** copied into the AI image. On EC2 it
is mounted read-only from:

```text
/opt/tata-vision/models/sam_vit_h_4b8939.pth
```

Inside the AI container, `SAM_CHECKPOINT` is:

```text
/models/sam_vit_h_4b8939.pth
```

## 1. Prepare the EC2 instance

The commands below assume Ubuntu on EC2. Use an instance with at least 16 GB
RAM; 32 GB is safer for SAM ViT-H plus the depth model. Allow at least 30 GB of
free EBS storage. The current geometric pipeline runs SAM on CPU, so a small
instance will be very slow even if it starts successfully.

In the instance security group, allow:

- TCP 22 from your own IP
- TCP 80 from the clients that should access the app
- TCP 443 when HTTPS is added

Connect and install Docker:

```bash
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
exit
```

Reconnect so the Docker group membership takes effect, then prepare the model
directory and put the application at `/opt/tata-vision/app`:

```bash
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP
sudo mkdir -p /opt/tata-vision/models
sudo chown -R "$USER":"$USER" /opt/tata-vision
git clone YOUR_REPOSITORY_URL /opt/tata-vision/app
```

If the source is not hosted in Git, copy it from the local repository instead:

```bash
rsync -az --exclude node_modules --exclude .git \
  -e "ssh -i /path/to/key.pem" ./ \
  ubuntu@EC2_PUBLIC_IP:/opt/tata-vision/app/
```

## 2. Upload the SAM model separately

Run this on the local computer from the repository root:

```bash
scp -i /path/to/key.pem \
  ai-services/models/sam_vit_h_4b8939.pth \
  ubuntu@EC2_PUBLIC_IP:/opt/tata-vision/models/sam_vit_h_4b8939.pth
```

Check that the upload is a regular file and compare hashes:

```bash
# Local computer
sha256sum ai-services/models/sam_vit_h_4b8939.pth

# EC2
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP \
  'sha256sum /opt/tata-vision/models/sam_vit_h_4b8939.pth'
```

On macOS, use `shasum -a 256` instead of `sha256sum` locally.

## 3. Configure secrets

On EC2:

```bash
cd /opt/tata-vision/app
cp .env.example .env
nano .env
```

Replace the database passwords and JWT secret. Generate suitable values with:

```bash
openssl rand -hex 32
```

Keep this setting unchanged when using the directory layout above:

```dotenv
SAM_MODEL_PATH=/opt/tata-vision/models/sam_vit_h_4b8939.pth
```

Set `EMAIL_USER` and `EMAIL_APP_PASSWORD` if registration verification and
password-reset email should work. `.env` is ignored by Git.

## 4. Build and start

```bash
cd /opt/tata-vision/app
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100
```

Open `http://EC2_PUBLIC_IP`. The frontend proxies `/api`, `/uploads`, and
`/outputs` to the backend, so no public ports are needed for the backend, AI
service, or database.

The first shading request downloads the Depth Anything model into the
persistent `hf_cache` Docker volume. The instance therefore needs outbound
internet access for that first download.

Useful checks:

```bash
curl http://127.0.0.1/api/health
docker compose exec ai-service python -c \
  "import os; print(os.environ['SAM_CHECKPOINT'], os.path.isfile(os.environ['SAM_CHECKPOINT']))"
docker compose logs --tail=200 ai-service backend
```

## Updating

```bash
cd /opt/tata-vision/app
git pull
docker compose up -d --build
```

Do not run `docker compose down -v` unless the MySQL data, uploads, and cached
Hugging Face model may be deleted. A normal `docker compose down` preserves
those named volumes.

## GitHub Actions CI/CD

The workflow in `.github/workflows/deploy.yml` builds ARM64 frontend, backend,
and AI images, pushes commit-SHA and `latest` tags to GHCR, and deploys the SHA
tag to the shared EC2 instance. It follows the same temporary SSH security-group
rule used by the invitation app.

Configure these GitHub Actions repository secrets:

- `AWS_DEPLOY_KEY_ID`
- `AWS_DEPLOY_KEY_SECRET`
- `EC2_HOST`
- `EC2_SSH_KEY`
- `WEBHOOK_SECRET` for the optional ops deployment event
- `EC2_SECURITY_GROUP_ID` only if it differs from the invitation app security
  group already used as the workflow fallback

Before the first automated deployment, create the server environment file:

```bash
ssh -i /path/to/key.pem ec2-user@EC2_PUBLIC_IP
mkdir -p /opt/paas/tata-vision
nano /opt/paas/tata-vision/.env
```

Copy the contents of `.env.production.example`, replace every placeholder, and
keep `SAM_MODEL_PATH` pointing at the separately uploaded checkpoint. The
workflow updates only `IMAGE_PREFIX` and `IMAGE_TAG`; it preserves all secrets.

The production stack binds host port 8090 only on `127.0.0.1`, so it does not
claim port 80 or expose the backend directly. The frontend also joins the
existing `paas_paas` network. Point the containerized Caddy reverse proxy at
`tata-vision:80`. If the shared network has a different name, set
`PAAS_NETWORK` in the server `.env`. Another loopback port can be selected with
`APP_PORT`.

Every push to `main` builds and deploys. To roll back, run **Build & Deploy**
manually in GitHub Actions and enter a previously built commit SHA in
`image_tag`. The build job is skipped and that existing image set is deployed.
