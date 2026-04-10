const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;
const HOST = '0.0.0.0';

function buscarURL(targetUrl) {
  return new Promise((resolve, reject) => {
    const lib = targetUrl.startsWith('https') ? https : http;
    lib.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extrairValor(html) {
  // Tenta pegar o valor total da página da SEFAZ
  const padroes = [
    /Valor\s+Total\s*[:\-]?\s*R?\$?\s*([\d.,]+)/i,
    /vNF[^>]*>\s*R?\$?\s*([\d.,]+)/i,
    /total[^>]*>\s*R?\$?\s*([\d.,]+)/i,
    /([\d]+[.,][\d]{2})\s*<\/td>/i,
  ];
  for (const p of padroes) {
    const m = html.match(p);
    if (m) return m[1].replace(',', '.');
  }
  return null;
}

function extrairNome(html) {
  const padroes = [
    /<b>([^<]{3,60})<\/b>/i,
    /Razão Social[^:]*:\s*<[^>]+>([^<]+)</i,
    /Emitente[^:]*:\s*<[^>]+>([^<]+)</i,
    /<h4[^>]*>([^<]{3,60})<\/h4>/i,
    /<h2[^>]*>([^<]{3,60})<\/h2>/i,
    /class="[^"]*nome[^"]*"[^>]*>([^<]{3,60})</i,
    /nomeEmitente[^>]*>([^<]+)</i,
  ];
  for (const p of padroes) {
    const m = html.match(p);
    if (m) {
      const nome = m[1].trim();
      if (nome.length > 3 && !/script|style|html|body/i.test(nome)) return nome;
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.url;

  if (!targetUrl) {
    res.end(JSON.stringify({ erro: 'Parâmetro url ausente' }));
    return;
  }

  try {
    const html = await buscarURL(decodeURIComponent(targetUrl));
    const nome = extrairNome(html);
    const valor = extrairValor(html);
    res.end(JSON.stringify({ nome, valor, ok: true }));
  } catch (e) {
    res.end(JSON.stringify({ erro: e.message, ok: false }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  // Pega o IP local automaticamente
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) { ip = net.address; break; }
    }
  }
  console.log(`\n✅ Servidor rodando!`);
  console.log(`   No computador: http://localhost:${PORT}`);
  console.log(`   No celular:    http://${ip}:${PORT}`);
  console.log(`\n📱 Abra o index.html pelo IP acima no celular.\n`);
});