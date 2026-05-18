module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin her zaman en sonda olmalı
      'react-native-reanimated/plugin',
    ],
  };
};
