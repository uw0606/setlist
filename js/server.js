// const http = require('http');
// const fs = require('fs');
// const path = require('path');

// http.createServer((req, res) => {
//   let filePath = '.' + req.url;
//   if (filePath === './') {
//     filePath = './index.html'; // デフォルトで index.html を表示
//   }

//   const extname = String(path.extname(filePath)).toLowerCase();
//   const mimeTypes = {
//     '.html': 'text/html',
//     '.js': 'text/javascript',
//     '.css': 'text/css',
//     '.json': 'application/json',
//     '.png': 'image/png',
//     '.jpg': 'image/jpg',
//     '.gif': 'image/gif',
//     '.svg': 'image/svg+xml',
//   };

//   const contentType = mimeTypes[extname] || 'application/octet-stream';

//   fs.readFile(filePath, (error, content) => {
//     if (error) {
//       if (error.code === 'ENOENT') {
//         res.writeHead(404, { 'Content-Type': 'text/html' });
//         res.end('404 Not Found');
//       } else {
//         res.writeHead(500, { 'Content-Type': 'text/html' });
//         res.end('500 Internal Server Error');
//       }
//     } else {
//       res.writeHead(200, { 'Content-Type': contentType });
//       res.end(content, 'utf-8');
//     }
//   });
// }).listen(3000);

// console.log('Server running at http://localhost:3000/');


const express = require('express');
const app = express();
const port = 3000;
let setlistState = null;

app.use(express.json());

app.post('/api/setlist/save', (req, res) => {
  setlistState = req.body;
  res.json({ message: 'Setlist state saved successfully.' });
});

app.get('/api/setlist/load', (req, res) => {
  res.json(setlistState);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

