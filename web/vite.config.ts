import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const API_PROXY_PREFIX = '/__doctrack_api';
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORTS = [8000, 8080];

function collectBody(
  req: IncomingMessage,
  callback: (err: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer | string) => {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  });
  req.on('end', () => callback(null, Buffer.concat(chunks)));
  req.on('error', (err) => callback(err));
}

function forwardToLaravel(
  req: IncomingMessage,
  res: ServerResponse,
  targetPath: string,
  bodyBuffer: Buffer,
  portIndex: number,
) {
  const port = BACKEND_PORTS[portIndex];
  const headers: http.OutgoingHttpHeaders = {
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
      forwardToLaravel(req, res, targetPath, bodyBuffer, portIndex + 1);
      return;
    }
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        code: 'BACKEND_UNREACHABLE',
        message: 'Tracely Laravel backend (:8000/:8080) is not running on this host.',
      }),
    );
  });

  proxyReq.end(bodyBuffer);
}

/**
 * Proxies Vite dev `/__doctrack_api/*` requests to Laravel on port 8000 with
 * silent fallback to port 8080 so terminal logs stay clean regardless of artisan port.
 */
function doctrackDevApiProxy(): Plugin {
  return {
    name: 'doctrack-dev-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (typeof req.url !== 'string' || !req.url.startsWith(API_PROXY_PREFIX)) {
          return next();
        }
        const targetPath = `/api${req.url.slice(API_PROXY_PREFIX.length)}`;
        collectBody(req, (err, bodyBuffer) => {
          if (err || !bodyBuffer) {
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
          forwardToLaravel(req, res, targetPath, bodyBuffer, 0);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), doctrackDevApiProxy()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/qrcode/')) {
            return 'vendor-qr';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    testTimeout: 15000,
  },
});
