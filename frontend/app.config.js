// Étend app.json : liens universels pilotés par UNE variable (PUBLIC_DOMAIN).
// Le jour où manent.app arrive : changer PUBLIC_DOMAIN (ou la variable d'env EXPO_PUBLIC_PUBLIC_BASE_URL), rien d'autre.
const PUBLIC_DOMAIN = (process.env.EXPO_PUBLIC_PUBLIC_BASE_URL || 'https://lecture-capture-24.preview.emergentagent.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    associatedDomains: [`applinks:${PUBLIC_DOMAIN}`],
  },
  android: {
    ...config.android,
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
  },
});
