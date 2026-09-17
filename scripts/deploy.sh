#!/usr/bin/env bash
# Script de déploiement — installation et configuration de DataShare.
# Automatise ce que le README documente à la main : base de données,
# fichier d'environnement, dépendances front et back.
#
# Usage : ./scripts/deploy.sh   (depuis la racine du dépôt)

set -e

cd "$(dirname "$0")/.."

echo "== DataShare — installation et configuration =="
echo ""

# 1. Base de données (MongoDB, via Docker Compose)
echo "-> Démarrage de MongoDB (Docker Compose)..."
docker compose up -d

echo "-> Attente que MongoDB réponde..."
tries=0
until docker exec datashare-mongo mongosh --quiet --eval "db.runCommand('ping')" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "   MongoDB ne répond toujours pas après 30s — vérifie 'docker compose logs mongo'."
    exit 1
  fi
  sleep 1
done
echo "   MongoDB prêt."
echo ""

# 2. Back-end : fichier .env + dépendances
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "-> backend/.env créé depuis .env.example."
  echo "   Pense à renseigner JWT_SECRET avant de démarrer l'API (ex : openssl rand -base64 48)."
else
  echo "-> backend/.env existe déjà, inchangé."
fi

echo "-> Installation des dépendances back-end (npm install)..."
(cd backend && npm install)
echo ""

# 3. Front-end : dépendances
echo "-> Installation des dépendances front-end (npm install)..."
(cd frontend && npm install)
echo ""

echo "== Installation terminée =="
echo ""
echo "Il reste à démarrer les deux applications, dans deux terminaux séparés :"
echo "  cd backend  && npm run start:dev   # API sur http://localhost:3000/api"
echo "  cd frontend && npm start           # application sur http://localhost:4200"
