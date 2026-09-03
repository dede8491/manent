// Étend app.json : liens Android pilotés par UNE variable (PUBLIC_DOMAIN).
// iOS : PAS d'associatedDomains (le profil de provisionnement Emergent n'inclut pas
// cette capacité → le build App Store échouait). Le partage passe par les pages
// /api/s/* et le scheme manent://. À réactiver seulement si un domaine est rattaché
// ET que l'entitlement Associated Domains est ajouté au profil Apple.
const PUBLIC_DOMAIN = (process.env.EXPO_PUBLIC_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    // Liens universels iOS (applinks) : la capacité « Associated Domains » doit être activée sur l'App ID
    // Apple ET présente dans le profil de provisionnement, sinon l'archive échoue (« ARCHIVE FAILED »).
    // Réactiver avec EXPO_PUBLIC_IOS_APPLINKS=1 une fois la capacité activée dans le portail développeur.
    ...(process.env.EXPO_PUBLIC_IOS_APPLINKS === '1' ? { associatedDomains: [`applinks:${PUBLIC_DOMAIN}`] } : {}),
  },
  android: {
    ...config.android,
    // Liens Android uniquement si un domaine est fourni par l'environnement de build
    ...(PUBLIC_DOMAIN ? {
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/q' },
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/b' },
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/c' },
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/@' },
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/api/s' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    } : {}),
  },
});
