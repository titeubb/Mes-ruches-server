# Serveur relais "Mes Ruches" — Guide d'installation

Ce serveur tourne en continu, collecte tes données BeeZbee toutes les heures,
garde l'historique, et envoie des notifications quand un poids varie de plus
de 1 kg (réglable). C'est lui qui rend les notifications fiables même quand
l'app est fermée sur ton iPhone.

## Étape 1 — Générer tes clés de notification (VAPID)

Sur ton Mac, ouvre le Terminal et tape :

```bash
npx web-push generate-vapid-keys
```

Tu obtiens deux clés : une "Public Key" et une "Private Key". Garde-les de côté,
on les colle à l'étape 3.

## Étape 2 — Créer un compte Render (gratuit)

1. Va sur https://render.com et crée un compte (gratuit, pas de carte bancaire nécessaire
   pour le plan gratuit)
2. Crée un compte GitHub si tu n'en as pas (https://github.com), c'est gratuit aussi —
   Render a besoin d'un dépôt Git pour déployer ton code

## Étape 3 — Mettre le code sur GitHub

1. Crée un nouveau dépôt sur GitHub (par exemple `mes-ruches-serveur`)
2. Mets-y les 3 fichiers de ce dossier (`server.js`, `package.json`, `README.md`)
3. Dans `server.js`, remplace :
   - `COLLE_TA_CLE_PUBLIQUE_ICI` par ta Public Key
   - `COLLE_TA_CLE_PRIVEE_ICI` par ta Private Key

   (Ou mieux : laisse ces lignes telles quelles et configure-les comme variables
   d'environnement à l'étape 4 — c'est plus propre et plus sûr.)

## Étape 4 — Déployer sur Render

1. Sur Render, clique "New +" → "Web Service"
2. Connecte ton dépôt GitHub `mes-ruches-serveur`
3. Renseigne :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free
4. Dans l'onglet "Environment", ajoute deux variables :
   - `VAPID_PUBLIC_KEY` = ta clé publique
   - `VAPID_PRIVATE_KEY` = ta clé privée
5. Clique "Deploy"

Au bout de quelques minutes, Render te donne une URL du type :
`https://mes-ruches-serveur.onrender.com`

C'est l'adresse que la PWA utilisera pour récupérer tes données et s'abonner
aux notifications.

## Vérifier que ça marche

Une fois déployé, ouvre dans ton navigateur :
`https://mes-ruches-serveur.onrender.com/api/ruches`

Tu dois voir un JSON avec les données de tes 3 ruches. Si c'est vide au début,
attends la prochaine collecte automatique (toutes les heures), ou déclenche-la
manuellement avec une requête POST sur `/api/collecter-maintenant`.

## Limite du plan gratuit Render

Le plan gratuit met le serveur "en veille" après 15 minutes sans visite, et le
réveil prend ~30 secondes. Comme la collecte tourne sur un cron interne, le
service doit rester éveillé pour collecter chaque heure — sur le plan gratuit,
Render peut mettre le service en pause s'il ne reçoit aucune requête web.

Solution simple et gratuite : un service comme https://cron-job.org peut
appeler ton URL `/api/ruches` toutes les 10-15 minutes pour garder le serveur
éveillé en continu, sans rien payer.

## Prochaine étape

Une fois ce serveur en ligne et qui répond, on branche la PWA dessus :
- Affichage des données en lisant `/api/ruches` au lieu des données fictives
- Abonnement aux notifications via `/api/subscribe`
