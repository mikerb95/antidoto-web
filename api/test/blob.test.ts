// Adaptadores de Vercel Blob (src/plataforma/): rutas con prefijo, siempre privado, y la firma de
// subidas solo para el evento y la clave permitidos. La librería se simula: no hay red.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const blob = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  head: vi.fn(),
  issueSignedToken: vi.fn(),
  handleUploadPresigned: vi.fn(),
}));
vi.mock('@vercel/blob', () => ({ get: blob.get, put: blob.put, del: blob.del, head: blob.head, issueSignedToken: blob.issueSignedToken }));
vi.mock('@vercel/blob/client', () => ({ handleUploadPresigned: blob.handleUploadPresigned }));

const { r2DesdeBlob } = await import('../src/plataforma/blob-r2');
const { subidaBlob } = await import('../src/plataforma/subida-blob');

beforeEach(() => {
  for (const f of Object.values(blob)) f.mockReset();
});

describe('R2 sobre Blob', () => {
  it('lee, escribe y borra con el prefijo y acceso privado', async () => {
    const b = r2DesdeBlob('archivos');
    const cuerpo = new ReadableStream();
    blob.get.mockResolvedValue({ statusCode: 200, stream: cuerpo, blob: { size: 5, contentType: 'image/png' } });
    const o = await b.get('proyectos/p/1');
    expect(blob.get).toHaveBeenCalledWith('archivos/proyectos/p/1', { access: 'private', useCache: false });
    expect(o).toMatchObject({ body: cuerpo, size: 5, httpMetadata: { contentType: 'image/png' } });

    blob.get.mockResolvedValue(null);
    expect(await b.get('no')).toBeNull();

    await b.put('x', new Uint8Array([1, 2]), { httpMetadata: { contentType: 'image/webp' } });
    expect(blob.put).toHaveBeenCalledWith('archivos/x', expect.any(Uint8Array), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/webp' });

    await b.delete('x');
    expect(blob.del).toHaveBeenCalledWith(['archivos/x']);
  });

  it('medios y archivos no se mezclan', async () => {
    await r2DesdeBlob('medios').delete(['a', 'b']);
    expect(blob.del).toHaveBeenCalledWith(['medios/a', 'medios/b']);
  });
});

describe('subida directa', () => {
  const req = new Request('https://api.x/');
  const evento = (pathname: string) => ({ type: 'blob.generate-presigned-url', payload: { pathname, clientPayload: null, multipart: false } });

  it('rechaza cualquier evento que no sea pedir una URL firmada (callbacks incluidos)', async () => {
    await expect(subidaBlob.firmar(req, { type: 'blob.upload-completed', payload: {} }, 'archivos', () => true, 10)).rejects.toThrow('evento no permitido');
    await expect(subidaBlob.firmar(req, null, 'archivos', () => true, 10)).rejects.toThrow('evento no permitido');
    expect(blob.handleUploadPresigned).not.toHaveBeenCalled();
  });

  it('firma solo la clave permitida, con tope de tamaño y sin sobrescribir', async () => {
    blob.issueSignedToken.mockResolvedValue({ delegationToken: 'd', clientSigningToken: 'c', validUntil: 1 });
    // Simula a la librería: llama a getSignedToken con la ruta que pidió el navegador.
    blob.handleUploadPresigned.mockImplementation(async (o: { body: { payload: { pathname: string } }; webhookPublicKey: string; getSignedToken: (r: string) => Promise<unknown> }) => ({
      llave: o.webhookPublicKey,
      firmado: await o.getSignedToken(o.body.payload.pathname),
    }));
    const permitida = (clave: string) => clave === 'proyectos/p/1';

    const r = (await subidaBlob.firmar(req, evento('archivos/proyectos/p/1'), 'archivos', permitida, 50)) as { llave: string; firmado: unknown };
    expect(r.llave).toBeTruthy();
    expect(r.firmado).toEqual({ token: { delegationToken: 'd', clientSigningToken: 'c', validUntil: 1 }, urlOptions: { maximumSizeInBytes: 50, addRandomSuffix: false, allowOverwrite: false } });
    expect(blob.issueSignedToken).toHaveBeenCalledWith(expect.objectContaining({ pathname: 'archivos/proyectos/p/1', operations: ['put'], maximumSizeInBytes: 50 }));

    await expect(subidaBlob.firmar(req, evento('archivos/proyectos/p/2'), 'archivos', permitida, 50)).rejects.toThrow('clave no permitida');
    await expect(subidaBlob.firmar(req, evento('medios/proyectos/p/1'), 'archivos', permitida, 50)).rejects.toThrow('clave no permitida');
    expect(blob.issueSignedToken).toHaveBeenCalledTimes(1);
  });

  it('info devuelve tamaño y tipo, o null si no existe', async () => {
    blob.head.mockResolvedValue({ size: 9, contentType: 'video/mp4' });
    expect(await subidaBlob.info('archivos', 'proyectos/p/1')).toEqual({ bytes: 9, mime: 'video/mp4' });
    expect(blob.head).toHaveBeenCalledWith('archivos/proyectos/p/1');
    blob.head.mockRejectedValue(new Error('BlobNotFoundError'));
    expect(await subidaBlob.info('archivos', 'x')).toBeNull();
  });
});
