// Archivos en Vercel: un store PRIVADO de Vercel Blob detrás de la parte de R2Bucket que usa la API
// (get, put y delete). Los dos buckets de Cloudflare (MEDIOS y ARCHIVOS) son prefijos del mismo
// store: medios/<clave> y archivos/<clave>, con la misma clave que guarda la base (clave_r2).
// Nada se sirve directo desde Blob: imágenes y archivos siguen saliendo por la API, que decide
// quién puede verlos, igual que con R2.
import { del, get, put } from '@vercel/blob';

export type Prefijo = 'medios' | 'archivos';

export const rutaBlob = (prefijo: Prefijo, clave: string) => `${prefijo}/${clave}`;

interface OpcionesPut {
  httpMetadata?: { contentType?: string; cacheControl?: string };
}

export function r2DesdeBlob(prefijo: Prefijo): R2Bucket {
  const bucket = {
    async get(clave: string) {
      const r = await get(rutaBlob(prefijo, clave), { access: 'private', useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return {
        key: clave,
        body: r.stream,
        size: r.blob.size,
        httpMetadata: { contentType: r.blob.contentType },
      };
    },
    async put(clave: string, cuerpo: ReadableStream | ArrayBuffer | ArrayBufferView | string, opciones?: OpcionesPut) {
      const datos = ArrayBuffer.isView(cuerpo) ? new Uint8Array(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength) : cuerpo;
      await put(rutaBlob(prefijo, clave), datos as ArrayBuffer, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: opciones?.httpMetadata?.contentType,
      });
      return { key: clave };
    },
    async delete(claves: string | string[]) {
      const lista = (Array.isArray(claves) ? claves : [claves]).map((c) => rutaBlob(prefijo, c));
      if (lista.length) await del(lista);
    },
  };
  return bucket as unknown as R2Bucket;
}
