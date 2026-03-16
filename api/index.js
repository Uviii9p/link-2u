const app = require('../backend/server.js');

// Ensure database is initialized before handling requests
// In a serverless environment, we might need to be careful with global state
// but the current server.js handles its own initialization.

module.exports = app;
