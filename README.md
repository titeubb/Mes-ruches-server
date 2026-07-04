# Serveur relais "Mes Ruches" v2 — Guide d'installation

## Ce que fait ce serveur
- Collecte tes 3 balances BeeZbee **toutes les heures** automatiquement
- Stocke tout l'historique dans une **base PostgreSQL** (persistante, ne se perd pas)
- Envoie une **notification push sur ton iPhone** quand le poids d'une ruche
  varie de plus de X kg (réglable sans redéployer)
- Expose une API que ta PWA lit pour afficher les courbes

---

## Étape 1 — Créer la base PostgreSQL sur Render

1. Va sur **dashboard.render.com**
2. Clique **"New +"** → **"PostgreSQL"**
3. Nom : `mes-ruches-db` · Plan : **Free**
4. Clique **"Create Database"**
5. Une fois créée, va dans **"Info"** → copie **"Internal Database URL"**

---

## Étape 2 — Configurer les variables d'environnement

Dans ton service `mes-ruches-server` sur Render → **"Environment"**, ajoute :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | L'URL PostgreSQL copiée à l'étape 1 |
| `VAPID_PUBLIC_KEY` | Ta clé publique VAPID |
| `VAPID_PRIVATE_KEY` | Ta clé privée VAPID |

---

## Étape 3 — Mettre à jour le code sur GitHub

Remplace les fichiers `server.js` et `package.json` dans ton dépôt GitHub par
ceux de ce dossier. Render redéploie automatiquement en quelques secondes.

---

## Étape 4 — Vérifier que ça marche

Ouvre dans ton navigateur :
```
https://mes-ruches-server.onrender.com/health
```
Tu dois voir `{"ok":true,"ts":"..."}`.

Puis :
```
https://mes-ruches-server.onrender.com/api/ruches
```
Tu dois voir les derniers relevés de tes 3 ruches en JSON.

---

## Étape 5 — Garder le serveur éveillé (gratuit)

Sur le plan gratuit Render, le serveur s'endort après 15 min sans trafic.

1. Va sur **cron-job.org** (gratuit) et crée un compte
2. Crée un job qui appelle toutes les **10 minutes** :
   `https://mes-ruches-server.onrender.com/health`
3. C'est tout — le serveur reste éveillé et collecte toutes les heures

---

## Modifier le seuil de notification

Par défaut : notification si variation ≥ **1,0 kg**.

Pour le changer (ex: 0.5 kg), envoie une requête depuis ton Terminal :
```bash
curl -X POST https://mes-ruches-server.onrender.com/api/config/seuil \
  -H "Content-Type: application/json" \
  -d '{"seuil_kg": 0.5}'
```
Ou depuis l'app directement (on ajoutera l'écran Réglages dans la PWA).

---

## Endpoints de l'API

| Méthode | URL | Description |
|---|---|---|
| GET | `/health` | Health check (pour cron-job.org) |
| GET | `/api/ruches` | Dernier relevé des 3 ruches |
| GET | `/api/ruches/:id/historique?jours=7` | Historique (7, 30, 365, ou tout) |
| GET | `/api/vapid-public-key` | Clé publique pour les notifs |
| POST | `/api/subscribe` | Abonner l'iPhone aux notifs |
| DELETE | `/api/subscribe` | Désabonner |
| GET | `/api/config/seuil` | Lire le seuil de notification |
| POST | `/api/config/seuil` | Modifier le seuil |
| POST | `/api/collecter-maintenant` | Forcer une collecte immédiate |
