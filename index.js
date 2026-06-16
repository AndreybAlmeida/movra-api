// MOVRA API v2.0
// - Render/local: Node.js server com app.listen()
// - Vercel: exporta o app Express como handler serverless
const app = require('./src/app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MOVRA API v2.0 na porta ${PORT}`));

module.exports = app;
