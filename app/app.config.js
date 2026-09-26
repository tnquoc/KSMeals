// Dynamic config on top of app.json. The web build for GitHub Pages is served from
// https://<user>.github.io/KSMeals/, so it needs that base path; local dev and native
// builds leave EXPO_BASE_URL unset.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
