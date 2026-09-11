// Étend app.json : liens Android pilotés par UNE variable (PUBLIC_DOMAIN).
// iOS : PAS d'associatedDomains (le profil de provisionnement Emergent n'inclut pas
// cette capacité → le build App Store échouait). Le partage passe par les pages
// /api/s/* et le scheme manent://. À réactiver seulement si un domaine est rattaché
// ET que l'entitlement Associated Domains est ajouté au profil Apple.
const PUBLIC_DOMAIN = (process.env.EXPO_PUBLIC_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

const APPLINKS_ON = process.env.EXPO_PUBLIC_IOS_APPLINKS === '1';

// Liens universels iOS (applinks) : la capacité « Associated Domains » doit être activée sur l'App ID Apple ET
// présente dans le profil de provisionnement, sinon l'archive échoue (« Provisioning profile doesn't support the
// Associated Domains capability »). Tant que EXPO_PUBLIC_IOS_APPLINKS n'est pas à 1, on retire l'entitlement
// partout : y compris s'il traîne dans app.json ou dans ios.entitlements d'une version fusionnée.
function iosWithoutApplinks(ios = {}) {
  const { associatedDomains: _dropped, entitlements, ...rest } = ios;
  const { 'com.apple.developer.associated-domains': _droppedToo, ...ent } = entitlements || {};
  return { ...rest, ...(Object.keys(ent).length ? { entitlements: ent } : {}) };
}

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...(APPLINKS_ON ? { ...config.ios, associatedDomains: [`applinks:${PUBLIC_DOMAIN}`] } : iosWithoutApplinks(config.ios)),
    infoPlist: {
      ...(config.ios && config.ios.infoPlist),
      // L'app n'utilise que HTTPS standard : pas de chiffrement soumis à déclaration, TestFlight n'attend plus de réponse manuelle.
      ITSAppUsesNonExemptEncryption: false,
    },
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
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/t' },
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/@' },
            { scheme: 'https', host: PUBLIC_DOMAIN, pathPrefix: '/api/s' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    } : {}),
  },
});
