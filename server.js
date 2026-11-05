/**
 * نقطه ورود سی‌پنل (Passenger / Setup Node.js App)
 * در سی‌پنل: Setup Node.js App → Application startup file = server.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { createServer } = require('http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Giftify ready on port ${port}`);
  });
});
