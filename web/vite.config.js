import os from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { qrcode } from 'vite-plugin-qrcode';

// IPs IPv4 reais da máquina (para liberar acesso via celular pelo IP da LAN).
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address);

export default defineConfig({
  plugins: [react(), qrcode()],
  server: {
    port: 5173,
    host: true, // expõe na LAN (0.0.0.0) para acesso via celular / QR code
    // Aceita só localhost + IPs desta máquina no header Host: permite o acesso
    // por IP na LAN, mas rejeita hostnames arbitrários (defesa contra DNS-rebinding).
    allowedHosts: ['localhost', '127.0.0.1', ...lanHosts],
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
