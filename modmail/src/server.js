/**
 * Modmail — src/server.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const express = require('express');
const path = require('path');
const config = require('./config');
const fs = require('fs');

function startServer() {
  const app = express();
  const transcriptsDir = path.join(process.cwd(), 'transcripts');
  
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
  }

  // Serve transcripts with explicit text/html Content-Type
  app.get('/transcripts/:filename', (req, res) => {
    const filePath = path.join(transcriptsDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Transcript not found');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(filePath);
  });

  app.get('/', (req, res) => {
    res.send('Modmail Bot Server Running.');
  });

  app.listen(config.expressPort, () => {
    console.log(`[Express] Transcripts hosted at ${config.publicUrl}/transcripts/`);
  });
}

module.exports = { startServer };
