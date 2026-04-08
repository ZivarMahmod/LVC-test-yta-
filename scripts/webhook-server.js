// ===========================================
// Kvittra — GitHub Webhook Auto-Deploy
// Liten HTTP-server som lyssnar på GitHub push-events
// och kör auto-deploy.sh automatiskt
//
// Setup:
//   1. Kör: node scripts/webhook-server.js &
//   2. Lägg till webhook i GitHub repo settings:
//      URL: http://din-ip:9090/deploy
//      Secret: samma som DEPLOY_SECRET i .env
//      Events: push
// ===========================================
import http from 'http';
import crypto from 'crypto';
import { execSync } from 'child_process';

const PORT = process.env.DEPLOY_PORT || 9090;
const SECRET = process.env.DEPLOY_SECRET || 'kvittra-deploy-secret';
const BRANCH = process.env.DEPLOY_BRANCH || 'claude/explore-migrate-supabase-gGM4t';
const SCRIPT = '/opt/lvcmediahub/scripts/auto-deploy.sh';

let deploying = false;

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${hmac}`),
    Buffer.from(signature)
  );
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', deploying }));
    return;
  }

  // Manual deploy trigger
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // Verifiera GitHub signature (om den finns)
      const sig = req.headers['x-hub-signature-256'];
      if (sig && !verifySignature(body, sig)) {
        log('❌ Ogiltig signatur');
        res.writeHead(403);
        res.end('Invalid signature');
        return;
      }

      // Kolla om det är rätt branch
      try {
        const payload = JSON.parse(body);
        if (payload.ref && !payload.ref.endsWith(BRANCH)) {
          log(`Ignorerar push till ${payload.ref} (väntar på ${BRANCH})`);
          res.writeHead(200);
          res.end('Ignored — wrong branch');
          return;
        }
      } catch {
        // Inte JSON — manuell trigger, kör ändå
      }

      if (deploying) {
        log('⏳ Deploy pågår redan, ignorerar');
        res.writeHead(200);
        res.end('Deploy already in progress');
        return;
      }

      log('🚀 Deploy triggas...');
      deploying = true;
      res.writeHead(200);
      res.end('Deploy started');

      // Kör deploy asynkront
      try {
        execSync(`bash ${SCRIPT} ${BRANCH}`, {
          timeout: 300000, // 5 min timeout
          stdio: 'inherit'
        });
        log('✅ Deploy klar');
      } catch (err) {
        log(`❌ Deploy misslyckades: ${err.message}`);
      } finally {
        deploying = false;
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  log(`🔗 Webhook-server lyssnar på port ${PORT}`);
  log(`   POST /deploy — trigga deploy`);
  log(`   GET /health — health check`);
  log(`   Branch: ${BRANCH}`);
});
