import server from '../dist/server/server.js';

function toNodeHeaders(headers) {
  const obj = {};
  for (const [k, v] of headers) obj[k] = v;
  return obj;
}

export default async function handler(req, res) {
  try {
    if (!server || typeof server.fetch !== 'function') {
      res.statusCode = 500;
      res.end('Server entry not available');
      return;
    }

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const url = `${proto}://${host}${req.url}`;

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });

    const response = await server.fetch(request, undefined, undefined);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      // Node disallows setting certain headers like transfer-encoding in some cases; skip if value is null
      if (value != null) res.setHeader(key, value);
    });

    const ab = await response.arrayBuffer();
    res.end(Buffer.from(ab));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
