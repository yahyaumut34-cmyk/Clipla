const appJson = require('./app.json');

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || appJson.expo.extra?.backendUrl || 'http://192.168.1.6:8000';

module.exports = ({ config }) => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      backendUrl,
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
