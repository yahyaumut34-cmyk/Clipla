const appJson = require('./app.json');

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || appJson.expo.extra?.backendUrl || 'https://clipla-backend-production.up.railway.app';
const apiKey    = process.env.EXPO_PUBLIC_API_KEY;

module.exports = ({ config }) => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      backendUrl,
      apiKey,
    },
    android: {
      ...appJson.expo.android,
      permissions: [
        'RECORD_AUDIO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'READ_MEDIA_VIDEO'
      ]
    },
  },
});
