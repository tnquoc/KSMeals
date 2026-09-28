// Dynamic config on top of app.json. The web app is served from the root of https://ksmeals.com/;
// EXPO_BASE_URL is only needed to host it under a sub-path (e.g. https://<user>.github.io/<repo>/).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
