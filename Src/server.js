const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { exec } = require('child_process');

const app = express();
const ROOT = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set(['.git', '.vscode', 'node_modules', 'Src']);

function isChinese(name) {
  return /[\u4e00-\u9fff]/.test(name);
}

// --- Static file serving ---
app.use('/Src', express.static(path.join(ROOT, 'Src')));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

// --- API: Home (root README) ---
app.get('/api/home', (req, res) => {
  const readmePath = path.join(ROOT, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return res.status(404).type('text/plain').send('# Welcome\n\nNo README.md found.');
  }
  res.type('text/plain').send(fs.readFileSync(readmePath, 'utf-8'));
});

// --- API: Directory tree ---
app.get('/api/tree', (req, res) => {
  const topDirs = fs.readdirSync(ROOT)
    .filter(name => {
      if (IGNORED_DIRS.has(name) || name.startsWith('.')) return false;
      const stat = fs.statSync(path.join(ROOT, name));
      return stat.isDirectory() && isChinese(name);
    })
    .sort();

  const tree = topDirs.map(name => buildTree(path.join(ROOT, name), name));
  res.json(tree);
});

function buildTree(absPath, relativePath) {
  const name = path.basename(absPath);
  const stat = fs.statSync(absPath);

  if (stat.isFile() && name.endsWith('.md')) {
    return {
      name: name.replace(/\.md$/, ''),
      type: 'file',
      path: relativePath.replace(/\.md$/, '')
    };
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(absPath).sort();
    const children = [];

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const entryAbs = path.join(absPath, entry);
      const entryRel = relativePath + '/' + entry;
      const entryStat = fs.statSync(entryAbs);

      if (entryStat.isDirectory()) {
        const subtree = buildTree(entryAbs, entryRel);
        if (subtree.children && subtree.children.length > 0) {
          children.push(subtree);
        }
      } else if (entryStat.isFile() && entry.endsWith('.md') && entry.toLowerCase() !== 'readme.md') {
        children.push(buildTree(entryAbs, entryRel));
      }
    }

    return { name, type: 'directory', children };
  }

  return null;
}

// --- API: Read a doc by full path ---
app.get('/api/doc/*', (req, res) => {
  const docPath = req.params[0];
  const filePath = path.resolve(ROOT, docPath + '.md');

  if (!filePath.startsWith(ROOT)) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).type('text/plain').send('Document not found');
  }
  res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
});

// --- API: Full-text search ---
app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json([]);

  const lowerQuery = query.toLowerCase();
  const results = [];
  const allFiles = collectAllMdFiles(ROOT);

  for (const { absPath, relPath } of allFiles) {
    const content = fs.readFileSync(absPath, 'utf-8');
    const fileName = path.basename(relPath, '.md');
    const dirPath = path.dirname(relPath);

    const nameMatch =
      fileName.toLowerCase().includes(lowerQuery) ||
      dirPath.toLowerCase().includes(lowerQuery);

    const contentMatches = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        contentMatches.push({ line: i + 1, text: lines[i].trim().substring(0, 200) });
        if (contentMatches.length >= 5) break;
      }
    }

    if (nameMatch || contentMatches.length > 0) {
      let score = 0;
      if (fileName.toLowerCase().includes(lowerQuery)) score += 10;
      if (dirPath.toLowerCase().includes(lowerQuery)) score += 3;
      score += Math.min(contentMatches.length, 5);

      results.push({
        path: relPath.replace(/\.md$/, ''),
        dirPath,
        fileName,
        score,
        matches: contentMatches
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  res.json(results.slice(0, 50));
});

function collectAllMdFiles(rootDir) {
  const files = [];
  const topDirs = fs.readdirSync(rootDir)
    .filter(name => {
      if (IGNORED_DIRS.has(name) || name.startsWith('.')) return false;
      const stat = fs.statSync(path.join(rootDir, name));
      return stat.isDirectory() && isChinese(name);
    });

  for (const dir of topDirs) {
    _walkDir(path.join(rootDir, dir), dir, files);
  }
  return files;
}

function _walkDir(absDir, relDir, files) {
  const entries = fs.readdirSync(absDir);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const entryAbs = path.join(absDir, entry);
    const entryRel = relDir + '/' + entry;
    const stat = fs.statSync(entryAbs);
    if (stat.isDirectory()) {
      _walkDir(entryAbs, entryRel, files);
    } else if (stat.isFile() && entry.endsWith('.md')) {
      files.push({ absPath: entryAbs, relPath: entryRel });
    }
  }
}

// --- Utility ---

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(findAvailablePort(startPort + 1)));
    server.once('listening', () => server.close(() => resolve(startPort)));
    server.listen(startPort);
  });
}

function openBrowser(url) {
  switch (process.platform) {
    case 'darwin': exec(`open "${url}"`); break;
    case 'win32': exec(`start "" "${url}"`); break;
    default: exec(`xdg-open "${url}"`); break;
  }
}

// --- Start server ---
(async () => {
  const portArg = process.argv.find(a => a.startsWith('--port='));
  const requestedPort = portArg ? parseInt(portArg.split('=')[1]) : 3000;
  const port = await findAvailablePort(requestedPort);

  app.listen(port, () => {
    console.log(`佛教经典电子书合集 running at http://localhost:${port}`);
    if (process.argv.includes('--open')) {
      openBrowser(`http://localhost:${port}`);
    }
  });
})();
