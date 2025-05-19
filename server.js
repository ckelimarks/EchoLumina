const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Serve static files from the current directory
app.use(express.static('./'));

// Generate SSL certificate using these commands:
// openssl genrsa -out key.pem
// openssl req -new -key key.pem -out csr.pem
// openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem

// Read the certificates
const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);

// Start the server
const PORT = 3001;
httpsServer.listen(PORT, () => {
  console.log(`HTTPS server running on port ${PORT}`);
  console.log(`Open https://localhost:${PORT} in your browser`);
  console.log('Or use your local IP address to connect from Oculus Quest 2');
  console.log('(Make sure your computer and Quest are on the same network)');
}); 