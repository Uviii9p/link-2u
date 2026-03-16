const app = require('../backend/server.js');

// Vercel Serverless Function entry point
module.exports = (req, res) => {
  // Pass to Express app
  return app(req, res);
};
