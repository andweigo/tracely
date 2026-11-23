const http = require('http');
const { Buffer } = require('buffer');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const API_PROXY_PREFIX = '/__doctrack_api';
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORTS = [8000, 8080];

function collectRequestBody(req, callback) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => callback(null, Buffer.concat(chunks)));
  req.on('error', (err) => callback(err));
}

function forwardToBackend(req, res, targetPath, bodyBuffer, portIndex) {
  const port = BACKEND_PORTS[portIndex];
  const headers = {
    ...req.headers,
    host: `${BACKEND_HOST}:${port}`,
  };
  if (headers['transfer-encoding']) {
    delete headers['transfer-encoding'];
    headers['content-length'] = String(bodyBuffer.length);
  }

  const proxyReq = http.request(
    {
      hostname: BACKEND_HOST,
      port,
      path: targetPath,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on('error', () => {
    if (res.headersSent || res.writableEnded) {
      return;
    }
    if (portIndex + 1 < BACKEND_PORTS.length) {
      forwardToBackend(req, res, targetPath, bodyBuffer, portIndex + 1);
      return;
    }
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        code: 'BACKEND_UNREACHABLE',
        message: 'DocsTracker Laravel backend (:8000/:8080) is not running on this host.',
      }),
    );
  });

  proxyReq.end(bodyBuffer);
}

/**
 * Metro configuration with built-in /__doctrack_api reverse-tunnel proxy so Android dev
 * builds can always reach local Laravel even if wireless ADB drops tcp:8000/8080 forwarding.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  server: {
    enhanceMiddleware: (middleware) => (req, res, next) => {
      if (typeof req.url === 'string' && req.url.startsWith(API_PROXY_PREFIX)) {
        const targetPath = `/api${req.url.slice(API_PROXY_PREFIX.length)}`;
        collectRequestBody(req, (err, bodyBuffer) => {
          if (err) {
            if (!res.headersSent && !res.writableEnded) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  code: 'INVALID_REQUEST_BODY',
                  message: 'Failed to read request body before proxying.',
                }),
              );
            }
            return;
          }
          forwardToBackend(req, res, targetPath, bodyBuffer, 0);
        });
        return;
      }
      return middleware(req, res, next);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
