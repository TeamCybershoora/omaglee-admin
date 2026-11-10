import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT, 10) || 3001;

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const distDir = path.join(__dirname, 'dist');
  const useDist = fs.existsSync(path.join(distDir, 'index.html'));
  const rootDir = useDist ? distDir : __dirname;

  let filePath = path.join(rootDir, safePath);

  // Check if file exists directly
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const publicPath = path.join(__dirname, 'public', safePath);
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      filePath = publicPath;
    } else {
      const rootPath = path.join(__dirname, safePath);
      if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
        filePath = rootPath;
      }
    }
  }

  // SPA fallback for HTML client-side routes
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (!path.extname(safePath)) {
      filePath = path.join(rootDir, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(` Omaglee Admin Panel Running: http://localhost:${PORT}/`);
  console.log(' Connected Backend: https://omaglee-backend-1.onrender.com/api');
  console.log('======================================================\n');
});
