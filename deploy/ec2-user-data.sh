#!/bin/bash
# Paste this into EC2 "Launch an instance" → Advanced details → User data.
# Runs once, automatically, on first boot — Docker and the compose plugin are
# ready by the time you SSH in, instead of a manual install step.
set -euo pipefail

dnf update -y
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Amazon Linux 2023's dnf repo doesn't carry the compose plugin; the official
# binary is the documented way to get `docker compose` on this AMI.
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# dnf's docker package ships buildx 0.12.1. Current Compose refuses to build
# anything under buildx 0.17 ("compose build requires buildx 0.17.0 or
# later") — hit this for real on the first deploy. Same fix as compose above:
# a current binary in the same plugins directory.
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then BUILDX_ARCH=amd64; else BUILDX_ARCH=arm64; fi
BUILDX_TAG=$(curl -sSL https://api.github.com/repos/docker/buildx/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -SL "https://github.com/docker/buildx/releases/download/${BUILDX_TAG}/buildx-${BUILDX_TAG}.linux-${BUILDX_ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# A 1 GiB (t3.micro) instance needs this — Postgres, the API and Next.js
# together comfortably exceed physical RAM during a build without it.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
