module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['transform-define', {
        'process.env.EXPO_ROUTER_APP_ROOT': '../../app',
        'process.env.EXPO_ROUTER_IMPORT_MODE': 'sync',
      }],
      // Required for react-native-reanimated (must be last)
      'react-native-reanimated/plugin',
    ],
  };
};

