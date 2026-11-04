// app.json'u temel alır. GitHub Pages gibi alt klasörden yayın için: EXPO_BASE_URL=/BULUT1.0
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
