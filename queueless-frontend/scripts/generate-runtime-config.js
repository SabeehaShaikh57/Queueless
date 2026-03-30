const fs = require('fs');
const path = require('path');

const apiBase = String(process.env.QL_API_BASE || '').trim();
const socketBase = String(process.env.QL_SOCKET_BASE || '').trim();

const outPath = path.join(__dirname, '..', 'js', 'runtime-config.js');

const content = `// Auto-generated at build time for deployment runtime config.\nwindow.__QL_API_BASE__ = ${JSON.stringify(apiBase)};\nwindow.__QL_SOCKET_BASE__ = ${JSON.stringify(socketBase)};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Generated runtime config at ${outPath}`);
