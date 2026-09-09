# DataShare

Prototype de plateforme de transfert sécurisé de fichiers (MVP).

## Stack

- Back-end : NestJS (TypeScript) — `backend/`
- Front-end : Angular — `frontend/`
- Base de données : MongoDB
- Stockage : système de fichiers local (`storage/`)

## Prérequis

- Node.js 24 LTS, npm 11
- Docker Desktop (pour MongoDB) OU un accès MongoDB Atlas

## Démarrage rapide

```bash

# 1. Base de données

docker compose up -d

# 2. Back-end

cd backend
cp .env.example .env   # puis renseigner JWT_SECRET
npm install
npm run start:dev      # http://localhost:3000/api

# 3. Front-end

cd ../frontend
npm install
npm start              # http://localhost:4200

## Documentation

Voir `../P3 - 2 Mission .../docs/`.
