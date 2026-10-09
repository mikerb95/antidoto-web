// Subida directa a Vercel Blob (src/env.ts, SubidaDirecta). El navegador pide una URL firmada para
// una sola clave, sube el archivo sin pasar por la función y después la API lo registra.
import { head, issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import type { SubidaDirecta } from '../env';
import { rutaBlob } from './blob-r2';

/** Vigencia de la URL firmada: alcanza para subir 50 MB con una conexión lenta. */
const VIGENCIA_MS = 30 * 60 * 1000;

export const subidaBlob: SubidaDirecta = {
  async firmar(req, cuerpo, prefijo, permitida, maxBytes) {
    // Solo se firman subidas: sin callback de Blob (el panel registra el archivo después), así que
    // cualquier otro evento se rechaza aquí.
    const evento = cuerpo as HandleUploadPresignedBody | null;
    if (evento?.type !== 'blob.generate-presigned-url') throw new Error('evento no permitido');
    return handleUploadPresigned({
      request: req,
      body: evento,
      // La librería exige la llave aunque solo la use para verificar callbacks, que aquí no hay.
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'sin-callback',
      getSignedToken: async (ruta) => {
        const clave = ruta.startsWith(`${prefijo}/`) ? ruta.slice(prefijo.length + 1) : '';
        if (!clave || !permitida(clave)) throw new Error('clave no permitida');
        const token = await issueSignedToken({
          pathname: rutaBlob(prefijo, clave),
          operations: ['put'],
          maximumSizeInBytes: maxBytes,
          validUntil: Date.now() + VIGENCIA_MS,
        });
        return { token, urlOptions: { maximumSizeInBytes: maxBytes, addRandomSuffix: false, allowOverwrite: false } };
      },
    });
  },
  async info(prefijo, clave) {
    try {
      const b = await head(rutaBlob(prefijo, clave));
      return { bytes: b.size, mime: b.contentType };
    } catch {
      return null;
    }
  },
};
