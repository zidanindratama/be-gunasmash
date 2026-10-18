import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { v2 as cloudinary } from 'cloudinary';

import { uploadImage } from '../../../src/modules/common/upload/cloudinary.js';
import { uploadRouter } from '../../../src/modules/uploads/upload.controller.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler() {
  const route = (uploadRouter as any).stack.find((layer: any) => layer.route?.path === '/image' && layer.route.methods.post);
  assert.ok(route, 'missing POST /image route');
  return route.route.stack.at(-1).handle;
}

function uploadMiddleware() {
  const route = (uploadRouter as any).stack.find((layer: any) => layer.route?.path === '/image' && layer.route.methods.post);
  assert.ok(route, 'missing POST /image route');
  return route.route.stack[1].handle;
}

function multipartRequest(file: Buffer) {
  const boundary = 'unit-test-boundary';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const req: any = Readable.from([head, file, tail]);
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(head.length + file.length + tail.length),
  };
  req.method = 'POST';
  req.url = '/image';
  return req;
}

function response() {
  const state: any = { body: undefined };
  const res: any = { json: (body: unknown) => { state.body = body; return res; } };
  return { res, state };
}

test('uploadImage sends the supplied buffer/folder to Cloudinary and maps provider response', async (t) => {
  let options: any;
  let uploadedBuffer: Buffer | undefined;
  replace(cloudinary.uploader, 'upload_stream', (arg: any, callback: (error: unknown, result: unknown) => void) => {
    options = arg;
    return { end: (buffer: Buffer) => { uploadedBuffer = buffer; callback(null, { secure_url: 'https://cdn.example/image.png', public_id: 'gunasmash/1' }); } };
  }, t);
  const buffer = Buffer.from('image-bytes');
  assert.deepEqual(await uploadImage(buffer, 'avatars'), { url: 'https://cdn.example/image.png', publicId: 'gunasmash/1' });
  assert.deepEqual(options, { folder: 'avatars' });
  assert.equal(uploadedBuffer, buffer);
});

test('uploadImage rejects Cloudinary errors', async (t) => {
  const failure = new Error('provider unavailable');
  replace(cloudinary.uploader, 'upload_stream', (_arg: unknown, callback: (error: unknown, result: unknown) => void) => ({
    end: () => callback(failure, undefined),
  }), t);
  await assert.rejects(uploadImage(Buffer.from('bytes'), 'folder'), failure);
});

test('upload route requires a file and rejects spoofed or unsupported image signatures', async (t) => {
  let providerCalls = 0;
  replace(cloudinary.uploader, 'upload_stream', (_arg: unknown, callback: (error: unknown, result: unknown) => void) => {
    providerCalls++;
    return { end: () => callback(null, { secure_url: 'https://cdn.example/x', public_id: 'x' }) };
  }, t);
  const handler = routeHandler();
  const missingErrors: any[] = [];
  await handler({}, response().res, (error: unknown) => missingErrors.push(error));
  assert.equal(missingErrors[0]?.message, 'File required');

  for (const [mimetype, buffer] of [
    ['image/png', Buffer.from('not-a-png')],
    ['image/jpeg', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['text/plain', Buffer.from('hello')],
  ] as const) {
    const errors: any[] = [];
    await handler({ file: { mimetype, buffer } }, response().res, (error: unknown) => errors.push(error));
    assert.equal(errors[0]?.status, 400);
    assert.match(errors[0]?.message, /Only valid PNG, JPEG, GIF, and WebP/);
  }
  assert.equal(providerCalls, 0);
});

test('upload route accepts PNG, JPEG, GIF and WebP signatures and sends the fixed folder', async (t) => {
  const valid = [
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/gif', Buffer.from('GIF89a')],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ] as const;
  let options: any[] = [];
  let uploads = 0;
  replace(cloudinary.uploader, 'upload_stream', (arg: any, callback: (error: unknown, result: unknown) => void) => {
    options.push(arg);
    return { end: () => { uploads++; callback(null, { secure_url: `https://cdn.example/${uploads}`, public_id: `image-${uploads}` }); } };
  }, t);
  for (const [mimetype, buffer] of valid) {
    const { res, state } = response();
    const errors: unknown[] = [];
    await routeHandler()({ file: { mimetype, buffer } }, res, (error: unknown) => errors.push(error));
    assert.deepEqual(errors, []);
    assert.equal(state.body.success, true);
    assert.equal(state.body.data.publicId, `image-${uploads}`);
  }
  assert.equal(uploads, 4);
  assert.deepEqual(options, Array.from({ length: 4 }, () => ({ folder: 'gunasmash' })));
});

test('upload route forwards provider errors to Express error middleware', async (t) => {
  const failure = new Error('Cloudinary failed');
  replace(cloudinary.uploader, 'upload_stream', (_arg: unknown, callback: (error: unknown, result: unknown) => void) => ({
    end: () => callback(failure, undefined),
  }), t);
  const errors: unknown[] = [];
  await routeHandler()({ file: { mimetype: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) } }, response().res,
    (error: unknown) => errors.push(error));
  assert.deepEqual(errors, [failure]);
});

test('Multer accepts a file at the 5 MiB limit and rejects one byte over', async () => {
  const middleware = uploadMiddleware();
  const exactLimit = multipartRequest(Buffer.alloc(5 * 1024 * 1024, 0x61));
  const exactResult = await new Promise<{ error: unknown; size?: number }>((resolve) => {
    middleware(exactLimit, {}, (error: unknown) => resolve({ error, size: exactLimit.file?.size }));
  });
  assert.equal(exactResult.error, undefined);
  assert.equal(exactResult.size, 5 * 1024 * 1024);

  const oversized = multipartRequest(Buffer.alloc(5 * 1024 * 1024 + 1, 0x61));
  const oversizedError = await new Promise<any>((resolve) => {
    middleware(oversized, {}, (error: unknown) => resolve(error));
  });
  assert.equal(oversizedError?.code, 'LIMIT_FILE_SIZE');
});
