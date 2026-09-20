# Manent — déploiement sans Emergent

Ce document décrit l'infrastructure cible et la marche à suivre, dans l'ordre. Tout se fait depuis un navigateur ;
aucun terminal n'est nécessaire côté propriétaire.

## Briques

| Brique | Service | Ce qu'il faut créer | Variables produites |
|---|---|---|---|
| Code | GitHub `dede8491/manent`, branche `main` | rien (déjà en place) | |
| Base de données | MongoDB Atlas (gratuit, M0) | un cluster, un utilisateur base, accès réseau `0.0.0.0/0` | `MONGO_URL`, `DB_NAME` |
| Backend | Railway (service depuis GitHub, dossier `backend/`) | un projet relié au dépôt | `PUBLIC_BASE_URL` (le domaine Railway) |
| Photos | Supabase Storage (gratuit) | un bucket **public** `manent-photos` | `SUPABASE_URL`, `SUPABASE_KEY` (clé *service_role*), `SUPABASE_BUCKET` |
| IA | Anthropic (console.anthropic.com) | une clé API | `ANTHROPIC_API_KEY` (+ `AI_MODEL` optionnel) |
| Push | Expo (gratuit) | rien de plus que le projet EAS | `EXPO_ACCESS_TOKEN` (optionnel) |
| Builds iOS | Expo EAS (compte expo.dev) + App Store Connect | un projet EAS, une clé API App Store Connect | secrets GitHub (voir plus bas) |

## Variables du backend (Railway → service → Variables)

```
MONGO_URL=mongodb+srv://<user>:<mot-de-passe>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=manent
PUBLIC_BASE_URL=https://<ton-service>.up.railway.app
CORS_ORIGINS=https://<ton-service>.up.railway.app
SUPABASE_URL=https://<projet>.supabase.co
SUPABASE_KEY=<clé service_role>
SUPABASE_BUCKET=manent-photos
ANTHROPIC_API_KEY=sk-ant-…
AI_MODEL=claude-opus-5            # ou claude-sonnet-5 pour réduire le coût
EXPO_ACCESS_TOKEN=                 # optionnel
```

Railway lit `backend/railway.json` : démarrage `uvicorn server:app`, contrôle de santé sur `/api/health`.
Chaque fusion sur `main` redéploie le backend automatiquement.

## Secrets GitHub (Settings → Secrets and variables → Actions)

| Secret | Où le trouver |
|---|---|
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens |
| `EAS_PROJECT_ID` | expo.dev → projet → Overview → Project ID |
| `EXPO_OWNER` | nom du compte Expo |
| `EXPO_PUBLIC_BACKEND_URL` | l'URL Railway, sans slash final |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `…_ANDROID_API_KEY`, `…_TEST_API_KEY` | RevenueCat → Project → API keys |
| `ASC_API_KEY_P8` | contenu du fichier `.p8` (App Store Connect → Users and Access → Integrations → App Store Connect API → clé avec rôle *App Manager*) |
| `ASC_KEY_ID` | l'identifiant de cette clé |
| `ASC_ISSUER_ID` | l'Issuer ID affiché sur la même page |
| `APPLE_TEAM_ID` | Apple Developer → Membership (ex. `LKS2WGPAQ5`) |

Le build iOS se lance depuis GitHub → Actions → « Build iOS (TestFlight) » → Run workflow. La toute première
fois, cocher « premiere_fois » : EAS crée alors le certificat de distribution, le profil de provisionnement, la clé
push et la clé de soumission grâce à la clé App Store Connect, et les conserve sur expo.dev. Les fois suivantes, la
case reste décochée. L'envoi automatique sur TestFlight sans intervention exige l'identifiant numérique de l'app
(App Store Connect → Informations sur l'app → « ID Apple ») dans `frontend/eas.json` (`submit.production.ios.ascAppId`).

## Ordre de mise en place

1. Atlas : cluster, utilisateur, adresse `0.0.0.0/0` autorisée → `MONGO_URL`.
2. Supabase : projet, bucket public `manent-photos`, clé service_role.
3. Anthropic : clé API.
4. Railway : nouveau projet → « Deploy from GitHub repo » → `dede8491/manent` → Root directory `backend` →
   variables ci-dessus → Generate domain. Vérifier `https://<service>/api/health`.
5. Expo : compte, puis projet EAS (expo.dev → Create a project, nom `manent`) → Project ID.
6. App Store Connect : clé API (rôle App Manager) → `.p8`, Key ID, Issuer ID.
7. GitHub : les secrets du tableau. Puis Actions → Build iOS (TestFlight).
8. TestFlight : installer la nouvelle version. Les universal links iOS restent désactivés tant que la capacité
   Associated Domains n'est pas ajoutée sur l'App ID Apple (`EXPO_PUBLIC_IOS_APPLINKS=1` ensuite).

## Données existantes (Emergent)

Deux options : repartir de zéro sur Atlas, ou exporter la base Emergent (`mongodump` avec l'URL fournie par
Emergent, depuis un ordinateur) puis `mongorestore` vers Atlas. Les photos stockées sur Emergent Object Storage
(URLs `/api/files/…`) ne sont pas transférables : les avatars concernés sont à re-téléverser.

## Ce qui a été retiré du code

Passerelle IA Emergent (`emergentintegrations`), stockage Emergent Object Storage, relais push Emergent,
échange de session Google Emergent (`/api/auth/session`, jamais appelé par l'app). Les dossiers `.emergent/`,
`Dockerfile.cloudbuild`, `entrypoint.sh`, `nginx.conf`, `etc/` et `test_reports/` ne servent plus qu'à Emergent
et peuvent être supprimés après la bascule.
