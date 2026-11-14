const appModule = require('../dist/app');
const app = appModule.default || appModule.app || appModule;

module.exports = app;
