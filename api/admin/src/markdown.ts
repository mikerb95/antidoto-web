// Vista previa del Markdown del contenido en el panel. Convertidor mínimo y seguro: primero escapa
// TODO el HTML y después aplica el formato (títulos, negrita, cursiva, enlaces http(s), listas,
// citas y párrafos). Nada de lo que escriba el equipo puede inyectar HTML. El sitio renderiza con
// el Markdown completo de Astro: esto es solo una aproximación para revisar.
//
// Módulo PURO, con pruebas.

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function enLinea(texto: string): string {
  return escapar(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_, t: string, url: string) => `<a href="${url}" rel="noopener" target="_blank">${t}</a>`);
}

export function markdownAHtml(md: string): string {
  const lineas = md.replace(/\r\n/g, '\n').split('\n');
  const salida: string[] = [];
  let parrafo: string[] = [];
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null;
  const cerrarParrafo = () => {
    if (parrafo.length) salida.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`);
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) salida.push(`<${lista.tipo}>${lista.items.map((i) => `<li>${enLinea(i)}</li>`).join('')}</${lista.tipo}>`);
    lista = null;
  };
  for (const linea of lineas) {
    const t = linea.trim();
    const titulo = /^(#{1,4})\s+(.+)$/.exec(t);
    const vineta = /^[-*]\s+(.+)$/.exec(t);
    const numero = /^\d+[.)]\s+(.+)$/.exec(t);
    const cita = /^>\s?(.*)$/.exec(t);
    if (!t) {
      cerrarParrafo();
      cerrarLista();
    } else if (titulo) {
      cerrarParrafo();
      cerrarLista();
      const n = Math.min(4, titulo[1]!.length + 1);
      salida.push(`<h${n}>${enLinea(titulo[2]!)}</h${n}>`);
    } else if (vineta || numero) {
      cerrarParrafo();
      const tipo = vineta ? 'ul' : 'ol';
      if (lista && lista.tipo !== tipo) cerrarLista();
      lista ??= { tipo, items: [] };
      lista.items.push((vineta ?? numero)![1]!);
    } else if (cita) {
      cerrarParrafo();
      cerrarLista();
      salida.push(`<blockquote>${enLinea(cita[1]!)}</blockquote>`);
    } else {
      cerrarLista();
      parrafo.push(t);
    }
  }
  cerrarParrafo();
  cerrarLista();
  return salida.join('\n');
}
