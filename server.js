/**
 * Serveur relais "Mes Ruches"
 * ----------------------------------------------------------
 * Ce serveur tourne en continu (hébergé sur Render gratuitement) :
 *  1. Toutes les heures, il va chercher les derniers poids/température/
 *     hygrométrie sur tes balances BeeZbee.
 *  2. Il stocke l'historique dans un fichier JSON (data.json).
 *  3. Si le poids d'une ruche varie de plus de SEUIL_KG entre deux
 *     relevés, il envoie une notification push sur ton iPhone.
 *  4. Il expose une API que la PWA (l'app sur ton écran d'accueil)
 *     vient lire pour afficher les courbes à jour.
 */

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const cron = require('node-cron');
const webpush = require('web-push');

const app = express();
app.use(express.json());

// ===================== CONFIGURATION =====================

// Tes 3 balances BeeZbee (ajoute/retire des lignes ici si besoin)
const RUCHES = [
  {
    id: '7B464',
    nom: 'Château Massilan',
    csvUrl: 'https://beezbee.ddns.net/beezbee-curve/beezbee-disp-7B464/importcsv.php'
  },
  {
    id: '7B462',
    nom: 'Lac Li Piboulos',
    csvUrl: 'https://beezbee.ddns.net/beezbee-curve/beezbee-disp-7B462/importcsv.php'
  },
  {
    id: '7B45C',
    nom: 'La Comtesse',
    csvUrl: 'https://beezbee.ddns.net/beezbee-curve/beezbee-disp-7B45C/importcsv.php'
  }
];

// Seuil de variation de poids (en kg) qui déclenche une notification
const SEUIL_KG = 1.0;

// Fichiers de stockage (simples fichiers JSON, suffisant pour un usage perso)
const DATA_FILE = './data.json';
const SUBS_FILE = './subscriptions.json';

// Clés VAPID pour les notifications push web.
// Génère les tiennes une fois avec : npx web-push generate-vapid-keys
// puis colle-les ici (ou en variables d'environnement sur Render).
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'COLLE_TA_CLE_PUBLIQUE_ICI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'COLLE_TA_CLE_PRIVEE_ICI';

webpush.setVapidDetails(
  'mailto:toi@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ===================== STOCKAGE =====================

function chargerDonnees() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function sauvegarderDonnees(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function chargerAbonnements() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
}

function sauvegarderAbonnements(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

// ===================== PARSING CSV BEEZBEE =====================

function parseCsv(texte) {
  const lignes = texte.trim().split('\n').slice(1); // on saute l'en-tête
  return lignes.map(ligne => {
    const [date, poids, temp, hygro] = ligne.split(';');
    return {
      date: date.trim(),
      poids: parseFloat(poids),
      temperature: parseFloat(temp),
      hygrometrie: parseFloat(hygro)
    };
  }).filter(r => !isNaN(r.poids));
}

// ===================== NOTIFICATIONS =====================

async function envoyerNotification(titre, corps) {
  const subs = chargerAbonnements();
  const payload = JSON.stringify({ title: titre, body: corps });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      console.error('Échec envoi notification (abonnement probablement expiré) :', err.message);
    }
  }
}

// ===================== COLLECTE HORAIRE =====================

async function collecterToutesLesRuches() {
  console.log(`[${new Date().toISOString()}] Collecte des données BeeZbee...`);
  const data = chargerDonnees();

  for (const ruche of RUCHES) {
    try {
      const reponse = await fetch(ruche.csvUrl);
      const texte = await reponse.text();
      const releves = parseCsv(texte);

      if (releves.length === 0) continue;

      const dernier = releves[releves.length - 1];
      const historique = data[ruche.id]?.historique || [];
      const dernierEnregistre = historique[historique.length - 1];

      // On n'ajoute le relevé que s'il est nouveau
      const estNouveau = !dernierEnregistre || dernierEnregistre.date !== dernier.date;

      if (estNouveau) {
        historique.push(dernier);
        // on garde un historique raisonnable (ex: 5000 derniers points)
        if (historique.length > 5000) historique.shift();

        // Détection de variation de poids significative
        if (dernierEnregistre && !isNaN(dernierEnregistre.poids)) {
          const variation = dernier.poids - dernierEnregistre.poids;
          if (Math.abs(variation) >= SEUIL_KG) {
            const sens = variation > 0 ? '+' : '';
            await envoyerNotification(
              `${ruche.nom} : variation de poids`,
              `${sens}${variation.toFixed(1)} kg → ${dernier.poids.toFixed(1)} kg`
            );
          }
        }

        data[ruche.id] = {
          nom: ruche.nom,
          historique,
          dernierReleve: dernier
        };
      }
    } catch (err) {
      console.error(`Erreur lors de la collecte pour ${ruche.nom} :`, err.message);
    }
  }

  sauvegarderDonnees(data);
  console.log('Collecte terminée.');
}

// Toutes les heures, à la minute 5 (pour laisser BeeZbee respirer)
cron.schedule('5 * * * *', collecterToutesLesRuches);

// Une collecte immédiate au démarrage du serveur
collecterToutesLesRuches();

// ===================== API POUR LA PWA =====================

// Récupérer les données de toutes les ruches
app.get('/api/ruches', (req, res) => {
  const data = chargerDonnees();
  res.json(data);
});

// Récupérer l'historique d'une ruche précise
app.get('/api/ruches/:id', (req, res) => {
  const data = chargerDonnees();
  const ruche = data[req.params.id];
  if (!ruche) return res.status(404).json({ erreur: 'Ruche inconnue' });
  res.json(ruche);
});

// Clé publique VAPID (la PWA en a besoin pour s'abonner aux notifications)
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

// Enregistrer un abonnement aux notifications (appelé depuis la PWA sur ton iPhone)
app.post('/api/subscribe', (req, res) => {
  const subs = chargerAbonnements();
  const nouveau = req.body;

  // on évite les doublons
  const existeDeja = subs.some(s => s.endpoint === nouveau.endpoint);
  if (!existeDeja) {
    subs.push(nouveau);
    sauvegarderAbonnements(subs);
  }
  res.status(201).json({ ok: true });
});

// Déclencher manuellement une collecte (pratique pour tester)
app.post('/api/collecter-maintenant', async (req, res) => {
  await collecterToutesLesRuches();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur relais démarré sur le port ${PORT}`));
