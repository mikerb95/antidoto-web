// Iconos de trazo (20x20, 1.6 px). Siempre decorativos: el texto de al lado dice qué es.
const TRAZOS: Record<string, string> = {
  inicio: 'M3 9.5L10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z',
  bandeja: 'M3 11l2.2-6.2A1 1 0 0 1 6.1 4h7.8a1 1 0 0 1 .9.8L17 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 11h4l1 2h4l1-2h4',
  chat: 'M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM7 8h6M7 11h4',
  proyectos: 'M3 6a1 1 0 0 1 1-1h4l1.5 2H16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  organizaciones: 'M4 17V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v12M12 9h3a1 1 0 0 1 1 1v7M3 17h14M7 7h2M7 10h2M7 13h2',
  correo: 'M3 5h14v10H3zM3 5l7 6 7-6',
  personas: 'M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 16c.4-2.6 2.5-4.5 5-4.5s4.6 1.9 5 4.5M13.5 4.2a2.5 2.5 0 0 1 0 4.6M14.5 11.8c1.6.5 2.7 2 3 4.2',
  contenido: 'M5 3h7l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 3v4h4M7 10h6M7 13h6',
  publicar: 'M10 13V3M6 7l4-4 4 4M4 13v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3',
  grafica: 'M3 17h14M6 14V9M10 14V5M14 14v-3',
  equipo: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c.5-3 3-5 6-5s5.5 2 6 5',
  ajustes: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4',
  auditoria: 'M6 3h8a1 1 0 0 1 1 1v13l-5-3-5 3V4a1 1 0 0 1 1-1zM8 7h4M8 10h4',
  sistema: 'M3 4h14v9H3zM7 17h6M10 13v4M6 9l2-2 2 3 2-2 2 2',
  buscar: 'M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12zM14 14l4 4',
  menu: 'M3 5h14M3 10h14M3 15h14',
  salir: 'M12 4h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3M8 14l-4-4 4-4M4 10h9',
  cuenta: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 16.5c.6-2.6 2.8-4.5 5.5-4.5s4.9 1.9 5.5 4.5',
  flecha: 'M8 5l5 5-5 5',
  externo: 'M11 4h5v5M16 4l-7 7M14 12v4H4V6h4',
  descargar: 'M10 3v10M6 9l4 4 4-4M4 16h12',
  mas: 'M10 4v12M4 10h12',
};

export function Icono({ nombre, class: clase }: { nombre: string; class?: string }) {
  return (
    <svg class={`icono${clase ? ` ${clase}` : ''}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={TRAZOS[nombre] ?? ''} />
    </svg>
  );
}
