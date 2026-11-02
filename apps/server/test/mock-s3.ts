/**
 * A stand-in S3 server for tests: path-style PUT / GET / HEAD of objects held in
 * memory. It ignores signatures, so it only checks that the server's storage
 * driver issues the right requests. Run: npx tsx test/mock-s3.ts
 */
import http from 'node:http';

const objects = new Map<string, { body: Buffer; type: string }>();
const port = Number(process.env.MOCK_S3_PORT ?? 4200);

http
  .createServer((req, res) => {
    const key = decodeURIComponent((req.url ?? '').split('?')[0]!);
    if (req.url === '/__count') return void res.end(String(objects.size));
    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        objects.set(key, {
          body: Buffer.concat(chunks),
          type: String(req.headers['content-type'] ?? ''),
        });
        res.writeHead(200, { ETag: '"mock"' }).end();
      });
      return;
    }
    const o = objects.get(key);
    if (!o)
      return void res
        .writeHead(404, { 'content-type': 'application/xml' })
        .end('<Error><Code>NoSuchKey</Code></Error>');
    res.writeHead(200, { 'content-type': o.type, 'content-length': o.body.length });
    res.end(req.method === 'HEAD' ? undefined : o.body);
  })
  .listen(port, () => console.log(`mock s3 on :${port}`));
