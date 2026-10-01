// Bandeja de solicitudes. JS propio, sin dependencias. Todo el contenido que viene de la base
// se pinta con textContent (nunca innerHTML) para que un lead no pueda inyectar HTML.
'use strict';

const ESTADOS = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cotizado: 'Cotizado',
  ganado: 'Ganado',
  perdido: 'Perdido',
};
const SERVICIOS = {
  formaciones: 'Formaciones vivenciales',
  audiovisual: 'Producción audiovisual',
  catering: 'Catering corporativo',
  diseno: 'Diseño de productos',
};

const $ = (s) => document.querySelector(s);

/** Crea un elemento. Los hijos de texto van como nodos de texto, nunca como HTML. */
function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    // Por CSSOM: la CSP del admin bloquea el atributo style.
    else if (k === 'style') for (const [p, x] of Object.entries(v)) el.style.setProperty(p, x);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const zona = 'America/Bogota';
const fecha = (ms, conHora) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: zona, day: 'numeric', month: 'short', ...(conHora ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(ms);
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const mes = (aaaamm) => {
  const [a, m] = aaaamm.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(new Date(a, m - 1, 1));
};

async function api(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    ...opciones,
    headers: opciones.body ? { 'content-type': 'application/json' } : {},
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    mostrarAcceso();
    throw new Error('sesion');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error || 'error'), { datos, status: res.status });
  return datos;
}

let toastTimer;
function avisar(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// Acceso -------------------------------------------------------------------

function mostrarAcceso() {
  $('#app').hidden = true;
  $('#acceso').hidden = false;
  const error = new URLSearchParams(location.search).get('error');
  if (error) {
    const aviso = $('#acceso-aviso');
    aviso.textContent = 'El enlace venció o ya se usó. Pide uno nuevo.';
    aviso.hidden = false;
  }
  $('#acceso-email').focus();
}

$('#form-acceso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = e.target.querySelector('button');
  boton.disabled = true;
  await fetch('/auth/enlace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: $('#acceso-email').value }),
  }).catch(() => null);
  const aviso = $('#acceso-aviso');
  aviso.textContent = 'Si el correo es del equipo, te llega un enlace en un minuto. Vence en 15 minutos.';
  aviso.hidden = false;
  boton.disabled = false;
});

$('#salir').addEventListener('click', async () => {
  await api('/auth/salir', { method: 'POST' }).catch(() => null);
  location.href = '/admin/';
});

// Navegación por hash: #leads, #metricas, #equipo o #<id de lead> ---------------

let yo = null;
const ID = /^[0-9a-f-]{36}$/;

function vista() {
  const hash = location.hash.slice(1);
  const nombre = ID.test(hash)
    ? 'leads'
    : hash.startsWith('campana-')
      ? 'campana'
      : hash.startsWith('contacto-')
        ? 'contactos'
        : ['leads', 'metricas', 'equipo', 'campanas', 'contactos'].includes(hash)
          ? hash
          : 'leads';
  if (nombre === 'equipo' && yo.rol !== 'admin') return (location.hash = '#leads');
  for (const v of document.querySelectorAll('.vista')) v.hidden = v.id !== `vista-${nombre}`;
  for (const a of document.querySelectorAll('[data-vista]')) {
    if (a.dataset.vista === nombre || (nombre === 'campana' && a.dataset.vista === 'campanas')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (nombre === 'leads') {
    cargarLeads();
    if (ID.test(hash)) abrirLead(hash);
    else $('#detalle').hidden = true;
  }
  if (nombre === 'metricas') cargarMetricas();
  if (nombre === 'equipo') cargarEquipo();
  if (nombre === 'campanas') cargarCampanas();
  if (nombre === 'campana') abrirCampana(hash.slice('campana-'.length));
  if (nombre === 'contactos') {
    cargarContactos();
    if (hash.startsWith('contacto-')) abrirContacto(hash.slice('contacto-'.length));
    else $('#contacto').hidden = true;
  }
  if (nombre !== 'campana') clearInterval(refresco);
}
window.addEventListener('hashchange', vista);

// Solicitudes --------------------------------------------------------------

const filtro = { estado: '', servicio: '', q: '', pagina: 0 };
let conteos = null;

function pintarChips() {
  const caja = $('#chips-estado');
  caja.replaceChildren(
    ...[['', 'Todas'], ...Object.entries(ESTADOS)].map(([valor, texto]) =>
      h(
        'button',
        {
          type: 'button',
          class: `chip ${valor ? `e-${valor}` : ''}`,
          'aria-pressed': String(filtro.estado === valor),
          onclick: () => {
            filtro.estado = valor;
            filtro.pagina = 0;
            pintarChips();
            cargarLeads();
          },
        },
        texto,
        conteos && valor ? h('span', { class: 'n' }, conteos[valor]) : null,
      ),
    ),
  );
}

async function cargarConteos() {
  const m = await api('/admin/api/metricas?dias=730');
  conteos = m.porEstado;
  pintarChips();
}

let pedido = 0;
async function cargarLeads() {
  const n = ++pedido;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtro)) if (v !== '' && v !== 0) p.set(k, v);
  const datos = await api(`/admin/api/leads?${p}`);
  if (n !== pedido) return;
  const actual = location.hash.slice(1);
  $('#filas').replaceChildren(
    ...datos.leads.map((l) =>
      h(
        'tr',
        { class: l.id === actual ? 'activa' : '', 'data-id': l.id },
        h('td', { class: 'fecha' }, fecha(l.creado)),
        h(
          'td',
          {},
          h('a', { href: `#${l.id}` }, l.anonimizado ? 'Datos suprimidos' : l.nombre),
          l.empresa ? h('span', { class: 'suave' }, l.empresa) : null,
        ),
        h('td', {}, SERVICIOS[l.servicio]),
        h('td', {}, h('span', { class: `estado e-${l.estado}` }, ESTADOS[l.estado])),
      ),
    ),
  );
  $('#vacio').hidden = datos.leads.length > 0;
  const paginas = Math.max(1, Math.ceil(datos.total / datos.porPagina));
  $('#pag-texto').textContent = `${datos.total} en total · página ${datos.pagina + 1} de ${paginas}`;
  $('#anterior').disabled = datos.pagina === 0;
  $('#siguiente').disabled = datos.pagina + 1 >= paginas;
}

$('#anterior').addEventListener('click', () => {
  filtro.pagina--;
  cargarLeads();
});
$('#siguiente').addEventListener('click', () => {
  filtro.pagina++;
  cargarLeads();
});
$('#f-servicio').addEventListener('change', (e) => {
  filtro.servicio = e.target.value;
  filtro.pagina = 0;
  cargarLeads();
});
let busqueda;
$('#f-q').addEventListener('input', (e) => {
  clearTimeout(busqueda);
  busqueda = setTimeout(() => {
    filtro.q = e.target.value.trim();
    filtro.pagina = 0;
    cargarLeads();
  }, 250);
});

const dato = (k, v) => (v === null || v === undefined || v === '' ? null : [h('dt', {}, k), h('dd', {}, v)]);

async function abrirLead(id) {
  const panel = $('#detalle');
  let datos;
  try {
    datos = await api(`/admin/api/leads/${id}`);
  } catch {
    panel.hidden = true;
    return;
  }
  for (const tr of document.querySelectorAll('#filas tr')) tr.classList.toggle('activa', tr.dataset.id === id);
  pintarDetalle(datos);
  panel.hidden = false;
  panel.querySelector('h2').focus();
}

function pintarDetalle({ lead: l, eventos, consentimientos }) {
  const panel = $('#detalle');
  const tel = l.telefono ? l.telefono.replace(/\D/g, '') : '';
  const contacto = l.anonimizado
    ? h('p', { class: 'suave' }, `Datos personales suprimidos el ${fecha(l.anonimizado, true)}.`)
    : h(
        'div',
        { class: 'acciones' },
        l.telefono ? h('a', { class: 'btn', href: `https://wa.me/${tel}`, target: '_blank', rel: 'noopener' }, 'WhatsApp') : null,
        l.email ? h('a', { class: 'btn btn-borde', href: `mailto:${l.email}` }, 'Correo') : null,
        l.telefono ? h('a', { class: 'btn btn-borde', href: `tel:${l.telefono}` }, 'Llamar') : null,
      );

  const estado = h('select', { name: 'estado', id: 'd-estado' }, ...Object.entries(ESTADOS).map(([v, t]) => h('option', { value: v, selected: v === l.estado }, t)));
  const motivo = h('label', { class: 'campo', hidden: l.estado !== 'perdido' }, 'Motivo de pérdida', h('input', { name: 'motivoPerdida', value: l.motivoPerdida || '', maxlength: 300 }));
  estado.addEventListener('change', () => (motivo.hidden = estado.value !== 'perdido'));

  const form = h(
    'form',
    { class: 'gestion' },
    h('label', { class: 'campo', for: 'd-estado' }, 'Estado'),
    estado,
    h('label', { class: 'campo' }, 'Valor estimado (COP)', h('input', { name: 'valorEstimado', inputmode: 'numeric', value: l.valorEstimado ?? '', pattern: '[0-9]*' })),
    motivo,
    h('label', { class: 'campo' }, 'Notas internas', h('textarea', { name: 'notas', rows: 4, maxlength: 5000 }, l.notas || '')),
    h('button', { class: 'btn', type: 'submit', disabled: !!l.anonimizado }, 'Guardar'),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const cuerpo = {
      estado: f.get('estado'),
      notas: f.get('notas'),
      valorEstimado: String(f.get('valorEstimado')).replace(/\D/g, '') || null,
      motivoPerdida: f.get('motivoPerdida') || null,
    };
    try {
      pintarDetalle(await api(`/admin/api/leads/${l.id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }));
      avisar('Cambios guardados');
      cargarLeads();
      cargarConteos();
    } catch {
      avisar('No se pudo guardar. Revisa los datos.');
    }
  });

  const suprimir =
    yo.rol === 'admin' && !l.anonimizado
      ? h(
          'button',
          {
            class: 'btn-texto peligro',
            type: 'button',
            onclick: async () => {
              if (!confirm('Esto borra nombre, contacto, mensaje y notas de este lead y revoca su autorización. No se puede deshacer. ¿Continuar?')) return;
              pintarDetalle(await api(`/admin/api/leads/${l.id}/anonimizar`, { method: 'POST' }));
              avisar('Datos suprimidos');
              cargarLeads();
            },
          },
          'Suprimir datos personales',
        )
      : null;

  const origen = [l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ') || l.referente || 'Directo';
  panel.replaceChildren(
    h(
      'div',
      { class: 'd-cabeza' },
      h('div', {}, h('p', { class: 'etq' }, SERVICIOS[l.servicio]), h('h2', { id: 'd-titulo', tabindex: -1 }, l.anonimizado ? 'Datos suprimidos' : l.nombre)),
      h('a', { class: 'cerrar', href: '#leads', 'aria-label': 'Cerrar detalle' }, '×'),
    ),
    contacto,
    h(
      'dl',
      {},
      dato('Organización', l.empresa),
      dato('Tipo', l.tipoOrganizacion),
      dato('Correo', l.email),
      dato('Teléfono', l.telefono),
      dato('Fecha del evento', l.fecha),
      dato('Personas', l.personas),
      dato('Ciudad', l.ciudad),
      dato('Llegó', fecha(l.creado, true)),
      dato('Origen', origen),
      dato('Página', l.pagina),
      dato('Idioma', l.locale === 'en' ? 'Inglés' : 'Español'),
    ),
    l.mensaje ? h('div', { class: 'mensaje' }, h('p', { class: 'etq' }, 'Mensaje'), h('p', {}, l.mensaje)) : null,
    form,
    h(
      'div',
      { class: 'historial' },
      h('p', { class: 'etq' }, 'Historial'),
      h(
        'ol',
        {},
        ...eventos.map((e) =>
          h('li', {}, h('span', { class: 'suave' }, fecha(e.creado, true)), ' ', textoEvento(e), e.autor ? h('span', { class: 'suave' }, ` · ${e.autor}`) : null),
        ),
      ),
    ),
    h(
      'div',
      { class: 'consentimiento' },
      h('p', { class: 'etq' }, 'Autorización de datos'),
      ...consentimientos.map((c) =>
        h('p', { class: 'suave' }, `Versión ${c.version}, aceptada el ${fecha(c.aceptado, true)}${c.revocado ? `, revocada el ${fecha(c.revocado, true)}` : ''}. `, h('q', {}, c.texto)),
      ),
      suprimir,
    ),
  );
}

function textoEvento(e) {
  if (e.tipo === 'creado') return 'Llegó la solicitud';
  if (e.tipo === 'estado') {
    const [de, a] = (e.detalle || '').split(' → ');
    return `Estado: ${ESTADOS[de] || de} → ${ESTADOS[a] || a}`;
  }
  if (e.tipo === 'nota') return e.detalle === null ? 'Nota (suprimida)' : 'Actualizó las notas';
  if (e.tipo === 'anonimizado') return 'Suprimió los datos personales';
  return e.detalle || 'Edición';
}

// Métricas -----------------------------------------------------------------

function barras(titulo, filas) {
  const max = Math.max(1, ...filas.map((f) => f.n));
  return h(
    'div',
    { class: 'tarjeta' },
    h('h2', {}, titulo),
    filas.length
      ? h(
          'ul',
          { class: 'barras' },
          ...filas.map((f) =>
            h(
              'li',
              {},
              h('span', { class: 'b-etq' }, f.etiqueta),
              h('span', { class: 'b-pista', 'aria-hidden': 'true' }, h('span', { class: `b-nivel ${f.clase || ''}`, style: { '--v': String(f.n / max) } })),
              h('span', { class: 'b-n' }, f.extra ? `${f.n} · ${f.extra}` : f.n),
            ),
          ),
        )
      : h('p', { class: 'suave' }, 'Sin datos todavía.'),
  );
}

async function cargarMetricas() {
  const m = await api(`/admin/api/metricas?dias=${$('#m-dias').value}`);
  const valorGanado = m.porServicio.reduce((a, s) => a + (s.valorGanado || 0), 0);
  const cifra = (etq, valor, nota) => h('div', { class: 'cifra' }, h('p', { class: 'etq' }, etq), h('p', { class: 'valor' }, valor), nota ? h('p', { class: 'suave' }, nota) : null);
  $('#metricas').replaceChildren(
    h(
      'div',
      { class: 'cifras' },
      cifra('Solicitudes', m.total),
      cifra('Tasa de cierre', m.tasaCierre === null ? 'Sin cierres' : `${Math.round(m.tasaCierre * 100)} %`, 'ganadas sobre ganadas más perdidas'),
      cifra('Primera respuesta', m.horasPrimeraRespuesta === null ? 'Sin datos' : `${m.horasPrimeraRespuesta.toFixed(1)} h`, 'mediana, de nuevo a contactado'),
      cifra('Valor ganado', pesos(valorGanado), 'según valor estimado'),
    ),
    h(
      'div',
      { class: 'rejilla' },
      barras('Embudo', Object.entries(ESTADOS).map(([k, t]) => ({ etiqueta: t, n: m.porEstado[k], clase: `e-${k}` }))),
      barras(
        'Por servicio',
        m.porServicio.map((s) => ({ etiqueta: SERVICIOS[s.clave], n: s.n, extra: `${s.ganados} ganadas` })),
      ),
      barras('De dónde llegan', m.porOrigen.map((o) => ({ etiqueta: o.clave, n: o.n }))),
      barras('Por mes', m.porMes.map((x) => ({ etiqueta: mes(x.clave), n: x.n }))),
    ),
  );
}
$('#m-dias').addEventListener('change', cargarMetricas);

// Equipo -------------------------------------------------------------------

async function cargarEquipo() {
  const { usuarios } = await api('/admin/api/usuarios');
  pintarEquipo(usuarios);
}

function pintarEquipo(usuarios) {
  $('#equipo').replaceChildren(
    ...usuarios.map((u) =>
      h(
        'li',
        { class: u.activo ? '' : 'inactivo' },
        h('span', {}, h('strong', {}, u.nombre), h('span', { class: 'suave' }, u.email)),
        h('span', { class: 'etq' }, u.rol === 'admin' ? 'Admin' : 'Equipo'),
        u.id === yo.id
          ? h('span', { class: 'suave' }, 'Tú')
          : h(
              'button',
              {
                class: 'btn-texto',
                type: 'button',
                onclick: async () => pintarEquipo((await api(`/admin/api/usuarios/${u.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !u.activo }) })).usuarios),
              },
              u.activo ? 'Quitar acceso' : 'Devolver acceso',
            ),
      ),
    ),
  );
}

$('#form-usuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const aviso = $('#usuario-aviso');
  try {
    pintarEquipo((await api('/admin/api/usuarios', { method: 'POST', body: JSON.stringify(Object.fromEntries(f)) })).usuarios);
    e.target.reset();
    aviso.textContent = 'Listo. Ya puede pedir su enlace de acceso.';
  } catch (err) {
    aviso.textContent = err.message === 'existe' ? 'Ese correo ya está en el equipo.' : 'Revisa el nombre y el correo.';
  }
  aviso.hidden = false;
});

// Campañas -----------------------------------------------------------------

const ESTADOS_CAMPANA = { borrador: 'Borrador', enviando: 'Enviando', enviada: 'Enviada', cancelada: 'Cancelada' };
const IDIOMAS = { es: 'Español', en: 'Inglés' };
const pct = (n, total) => (total ? `${Math.round((n / total) * 100)} %` : '0 %');
const cuenta = (n, uno, varios) => `${n || 0} ${n === 1 ? uno : varios}`;
let refresco;

async function cargarCampanas() {
  const { campanas } = await api('/admin/api/campanas');
  $('#campanas-filas').replaceChildren(
    ...campanas.map((c) => {
      const st = c.stats || {};
      return h(
        'tr',
        {},
        h('td', {}, h('a', { href: `#campana-${c.id}` }, c.asunto), h('span', { class: 'suave' }, `${IDIOMAS[c.locale]}${c.intereses.length ? ` · ${c.intereses.map((i) => SERVICIOS[i]).join(', ')}` : ''}`)),
        h('td', {}, h('span', { class: `estado c-${c.estado}` }, ESTADOS_CAMPANA[c.estado])),
        h('td', { class: 'num' }, st.destinatarios ? `${st.enviados} de ${st.destinatarios}` : ''),
        h('td', { class: 'num' }, st.enviados ? pct(st.abiertos, st.enviados) : ''),
        h('td', { class: 'num' }, st.enviados ? pct(st.clics, st.enviados) : ''),
        h('td', { class: 'fecha' }, fecha(c.iniciada || c.creada)),
      );
    }),
  );
  $('#campanas-vacio').hidden = campanas.length > 0;
}

const AYUDA_FORMATO = [
  '# Título  y  ## Subtítulo',
  '**negrita**, *cursiva*, [texto](https://enlace)',
  '- elementos de lista',
  '[[Texto del botón|https://enlace]]',
  '![Descripción](https://imagen.jpg)',
  '{{nombre}} pone el nombre de cada persona',
  'Deja una línea en blanco entre bloques.',
];

async function abrirCampana(id) {
  clearInterval(refresco);
  const caja = $('#campana');
  if (id === 'nueva') {
    $('#t-campana').textContent = 'Nueva campaña';
    pintarEditor(caja, null, null);
    return;
  }
  let datos;
  try {
    datos = await api(`/admin/api/campanas/${id}`);
  } catch {
    location.hash = '#campanas';
    return;
  }
  $('#t-campana').textContent = datos.campana.asunto;
  if (datos.campana.estado === 'borrador') pintarEditor(caja, datos.campana, datos.audiencia);
  else {
    pintarResultados(caja, datos);
    if (datos.campana.estado === 'enviando') refresco = setInterval(() => abrirCampana(id), 10000);
  }
}

function pintarEditor(caja, c, audiencia) {
  const intereses = new Set(c?.intereses || []);
  const form = h(
    'form',
    { class: 'editor' },
    h('label', { class: 'campo' }, 'Asunto', h('input', { name: 'asunto', required: true, maxlength: 150, value: c?.asunto || '' })),
    h('label', { class: 'campo' }, 'Texto de vista previa (opcional)', h('input', { name: 'preheader', maxlength: 200, value: c?.preheader || '' })),
    h(
      'div',
      { class: 'fila-campos' },
      h('label', { class: 'campo' }, 'Idioma', h('select', { name: 'locale' }, ...Object.entries(IDIOMAS).map(([v, t]) => h('option', { value: v, selected: (c?.locale || 'es') === v }, t)))),
      h(
        'fieldset',
        { class: 'intereses' },
        h('legend', {}, 'Solo a interesados en (vacío es para todos)'),
        ...Object.entries(SERVICIOS).map(([v, t]) => h('label', {}, h('input', { type: 'checkbox', name: 'intereses', value: v, checked: intereses.has(v) }), t)),
      ),
    ),
    h('label', { class: 'campo' }, 'Mensaje', h('textarea', { name: 'cuerpo', rows: 16, required: true }, c?.cuerpo || '')),
    h('details', { class: 'ayuda' }, h('summary', {}, 'Cómo dar formato'), h('ul', {}, ...AYUDA_FORMATO.map((a) => h('li', {}, a)))),
    h('div', { class: 'acciones' }, h('button', { class: 'btn', type: 'submit' }, c ? 'Guardar cambios' : 'Crear borrador')),
  );
  const leer = () => {
    const f = new FormData(form);
    return { asunto: f.get('asunto'), preheader: f.get('preheader'), locale: f.get('locale'), intereses: f.getAll('intereses'), cuerpo: f.get('cuerpo') };
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = c
        ? await api(`/admin/api/campanas/${c.id}`, { method: 'PATCH', body: JSON.stringify(leer()) })
        : await api('/admin/api/campanas', { method: 'POST', body: JSON.stringify(leer()) });
      avisar('Borrador guardado');
      if (!c) location.hash = `#campana-${r.campana.id}`;
      else pintarEditor(caja, r.campana, r.audiencia);
    } catch {
      avisar('Revisa el asunto y el mensaje.');
    }
  });

  const lateral = c
    ? h(
        'div',
        { class: 'lateral' },
        h('p', { class: 'etq' }, 'Vista previa'),
        h('iframe', { class: 'vista-previa', title: 'Vista previa del correo', src: `/admin/api/campanas/${c.id}/vista?v=${c.actualizada}` }),
        h('p', { class: 'audiencia' }, audiencia ? `Le llegará a ${audiencia} ${audiencia === 1 ? 'contacto activo' : 'contactos activos'}.` : 'Nadie cumple estos filtros todavía.'),
        h(
          'div',
          { class: 'acciones' },
          h(
            'button',
            {
              class: 'btn btn-borde',
              type: 'button',
              onclick: async () => {
                try {
                  const r = await api(`/admin/api/campanas/${c.id}/prueba`, { method: 'POST' });
                  avisar(`Prueba enviada a ${r.para}`);
                } catch {
                  avisar('No se pudo enviar la prueba. ¿Está configurado Resend?');
                }
              },
            },
            'Enviarme una prueba',
          ),
          h(
            'button',
            {
              class: 'btn',
              type: 'button',
              disabled: !audiencia,
              onclick: async () => {
                if (!confirm(`Se enviará "${c.asunto}" a ${audiencia} contactos. No se puede deshacer. ¿Enviar?`)) return;
                try {
                  await api(`/admin/api/campanas/${c.id}/enviar`, { method: 'POST', body: JSON.stringify({ destinatarios: audiencia }) });
                  avisar('Enviando');
                  abrirCampana(c.id);
                } catch (err) {
                  if (err.datos?.error === 'audiencia_cambio') {
                    avisar(`La audiencia cambió: ahora son ${err.datos.audiencia}. Revisa y vuelve a enviar.`);
                    abrirCampana(c.id);
                  } else avisar(err.status === 503 ? 'Falta configurar Resend para enviar.' : 'No se pudo enviar.');
                }
              },
            },
            'Enviar',
          ),
        ),
        h(
          'button',
          {
            class: 'btn-texto peligro',
            type: 'button',
            onclick: async () => {
              if (!confirm('¿Borrar este borrador?')) return;
              await api(`/admin/api/campanas/${c.id}`, { method: 'DELETE' });
              location.hash = '#campanas';
            },
          },
          'Borrar borrador',
        ),
      )
    : h('div', { class: 'lateral' }, h('p', { class: 'suave' }, 'Guarda el borrador para ver la vista previa, enviarte una prueba y ver a cuántos contactos les llega.'));

  caja.replaceChildren(h('div', { class: 'campana-editor' }, form, lateral));
}

function pintarResultados(caja, { campana: c, stats }) {
  const st = stats || {};
  const cifra = (etq, valor, nota) => h('div', { class: 'cifra' }, h('p', { class: 'etq' }, etq), h('p', { class: 'valor' }, valor), nota ? h('p', { class: 'suave' }, nota) : null);
  caja.replaceChildren(
    h(
      'p',
      { class: 'suave' },
      `${ESTADOS_CAMPANA[c.estado]} · ${IDIOMAS[c.locale]} · iniciada el ${fecha(c.iniciada, true)}${c.terminada ? `, terminó el ${fecha(c.terminada, true)}` : ''} · por ${c.autor}`,
    ),
    h(
      'div',
      { class: 'cifras' },
      cifra('Enviados', `${st.enviados || 0} de ${st.destinatarios || 0}`, st.pendientes ? `${st.pendientes} en cola` : st.fallidos ? `${st.fallidos} fallidos` : null),
      cifra('Entregados', pct(st.entregados, st.enviados), cuenta(st.entregados, 'correo', 'correos')),
      cifra('Abiertos', pct(st.abiertos, st.entregados || st.enviados), cuenta(st.abiertos, 'persona', 'personas')),
      cifra('Clics', pct(st.clics, st.entregados || st.enviados), cuenta(st.clics, 'persona', 'personas')),
    ),
    h(
      'div',
      { class: 'cifras' },
      cifra('Bajas', st.bajas || 0, 'desde esta campaña'),
      cifra('Rebotes', st.rebotes || 0, 'direcciones que no existen'),
      cifra('Quejas', st.quejas || 0, 'marcado como spam'),
      c.estado === 'enviando'
        ? h(
            'div',
            { class: 'cifra' },
            h('p', { class: 'etq' }, 'En curso'),
            h('p', { class: 'suave' }, 'Salen lotes de 100 cada 5 minutos.'),
            h(
              'button',
              {
                class: 'btn-texto peligro',
                type: 'button',
                onclick: async () => {
                  if (!confirm('¿Detener el envío? Lo que ya salió no se puede recuperar.')) return;
                  await api(`/admin/api/campanas/${c.id}/cancelar`, { method: 'POST' });
                  abrirCampana(c.id);
                },
              },
              'Detener envío',
            ),
          )
        : h('div', { class: 'cifra' }, h('p', { class: 'etq' }, 'Abiertos y clics'), h('p', { class: 'suave' }, 'Muchos programas de correo bloquean el conteo de aperturas: tómalo como referencia.')),
    ),
    h('p', { class: 'etq' }, 'Correo enviado'),
    h('iframe', { class: 'vista-previa', title: 'Correo enviado', src: `/admin/api/campanas/${c.id}/vista` }),
  );
}

// Contactos ----------------------------------------------------------------

const ESTADOS_CONTACTO = { activo: 'Activo', pendiente: 'Sin confirmar', baja: 'De baja', rebotado: 'Rebotado' };
const ORIGENES = { pie: 'Pie del sitio', cotizador: 'Cotizador', admin: 'Invitación del equipo' };
const MOTIVOS = { enlace: 'enlace de baja', queja: 'lo marcó como spam', rebote: 'rebote', admin: 'el equipo', supresion: 'supresión de datos' };
const filtroC = { estado: '', q: '', pagina: 0 };

async function cargarContactos() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtroC)) if (v !== '' && v !== 0) p.set(k, v);
  const d = await api(`/admin/api/contactos?${p}`);
  const total = Object.values(d.conteos).reduce((a, b) => a + b, 0);
  $('#chips-contactos').replaceChildren(
    ...[['', 'Todos', total], ...Object.entries(ESTADOS_CONTACTO).map(([k, t]) => [k, t, d.conteos[k]])].map(([valor, texto, n]) =>
      h(
        'button',
        {
          type: 'button',
          class: `chip ${valor ? `k-${valor}` : ''}`,
          'aria-pressed': String(filtroC.estado === valor),
          onclick: () => {
            filtroC.estado = valor;
            filtroC.pagina = 0;
            cargarContactos();
          },
        },
        texto,
        h('span', { class: 'n' }, n),
      ),
    ),
  );
  const actual = location.hash.replace(/^#contacto-/, '');
  $('#contactos-filas').replaceChildren(
    ...d.contactos.map((c) =>
      h(
        'tr',
        { class: c.id === actual ? 'activa' : '', 'data-id': c.id },
        h('td', {}, h('a', { href: `#contacto-${c.id}` }, c.email), c.nombre || c.empresa ? h('span', { class: 'suave' }, [c.nombre, c.empresa].filter(Boolean).join(' · ')) : null),
        h('td', {}, h('span', { class: `estado k-${c.estado}` }, ESTADOS_CONTACTO[c.estado])),
        h('td', { class: 'suave' }, c.intereses.map((i) => SERVICIOS[i]).join(', ')),
        h('td', { class: 'fecha' }, fecha(c.creado)),
      ),
    ),
  );
  $('#contactos-vacio').hidden = d.contactos.length > 0;
  const paginas = Math.max(1, Math.ceil(d.total / d.porPagina));
  $('#c-pag').textContent = `${d.total} en total · página ${d.pagina + 1} de ${paginas}`;
  $('#c-anterior').disabled = d.pagina === 0;
  $('#c-siguiente').disabled = d.pagina + 1 >= paginas;
}

$('#c-anterior').addEventListener('click', () => {
  filtroC.pagina--;
  cargarContactos();
});
$('#c-siguiente').addEventListener('click', () => {
  filtroC.pagina++;
  cargarContactos();
});
let busquedaC;
$('#c-q').addEventListener('input', (e) => {
  clearTimeout(busquedaC);
  busquedaC = setTimeout(() => {
    filtroC.q = e.target.value.trim();
    filtroC.pagina = 0;
    cargarContactos();
  }, 250);
});

async function abrirContacto(id) {
  const panel = $('#contacto');
  let d;
  try {
    d = await api(`/admin/api/contactos/${id}`);
  } catch {
    panel.hidden = true;
    return;
  }
  pintarContacto(d);
  panel.hidden = false;
  panel.querySelector('h2').focus();
}

function pintarContacto({ contacto: c, consentimientos, envios }) {
  const accion = (texto, ruta, pregunta, clase = 'btn-texto') =>
    h(
      'button',
      {
        class: clase,
        type: 'button',
        onclick: async () => {
          if (!confirm(pregunta)) return;
          pintarContacto(await api(ruta, { method: 'POST' }));
          avisar('Listo');
          cargarContactos();
        },
      },
      texto,
    );
  $('#contacto').replaceChildren(
    h(
      'div',
      { class: 'd-cabeza' },
      h('div', {}, h('p', { class: 'etq' }, ESTADOS_CONTACTO[c.estado]), h('h2', { id: 'ct-titulo', tabindex: -1 }, c.nombre || c.email)),
      h('a', { class: 'cerrar', href: '#contactos', 'aria-label': 'Cerrar detalle' }, '×'),
    ),
    h(
      'dl',
      {},
      dato('Correo', c.email),
      dato('Organización', c.empresa),
      dato('Idioma', IDIOMAS[c.locale]),
      dato('Llegó por', ORIGENES[c.origen]),
      dato('Intereses', c.intereses.map((i) => SERVICIOS[i]).join(', ')),
      dato('Desde', fecha(c.creado, true)),
      dato('Confirmó', c.confirmado ? fecha(c.confirmado, true) : null),
      dato('Baja', c.baja ? `${fecha(c.baja, true)} (${MOTIVOS[c.motivoBaja] || c.motivoBaja})` : null),
    ),
    h(
      'div',
      { class: 'historial' },
      h('p', { class: 'etq' }, 'Últimas campañas'),
      envios.length
        ? h('ol', {}, ...envios.map((e) => h('li', {}, e.campana, h('span', { class: 'suave' }, ` · ${e.enviado ? fecha(e.enviado) : e.estado}${e.abierto ? ' · abrió' : ''}${e.clic ? ' · hizo clic' : ''}`))))
        : h('p', { class: 'suave' }, 'Todavía no ha recibido campañas.'),
    ),
    h(
      'div',
      { class: 'consentimiento' },
      h('p', { class: 'etq' }, 'Autorización para novedades'),
      ...(consentimientos.length
        ? consentimientos.map((x) =>
            h(
              'p',
              { class: 'suave' },
              `Versión ${x.version}, aceptada el ${fecha(x.aceptado, true)}${x.confirmado ? `, confirmada el ${fecha(x.confirmado, true)}` : ', sin confirmar'}${x.revocado ? `, revocada el ${fecha(x.revocado, true)}` : ''}. `,
              h('q', {}, x.texto),
            ),
          )
        : [h('p', { class: 'suave' }, 'Sin autorización todavía: se registra cuando confirme desde su correo.')]),
      c.estado === 'activo' || c.estado === 'pendiente' ? accion('Dar de baja', `/admin/api/contactos/${c.id}/baja`, 'Dejará de recibir campañas. ¿Continuar?') : null,
      yo.rol === 'admin' && c.motivoBaja !== 'supresion'
        ? accion('Suprimir datos personales', `/admin/api/contactos/${c.id}/suprimir`, 'Borra el correo, el nombre y la organización, y revoca la autorización. No se puede deshacer. ¿Continuar?', 'btn-texto peligro')
        : null,
    ),
  );
}

$('#abrir-invitar').addEventListener('click', () => {
  const f = $('#form-invitar');
  f.hidden = !f.hidden;
  if (!f.hidden) f.querySelector('input').focus();
});
$('#form-invitar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const aviso = $('#invitar-aviso');
  try {
    await api('/admin/api/contactos', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    e.target.reset();
    aviso.textContent = 'Invitación enviada. Aparecerá como activa cuando confirme.';
    cargarContactos();
  } catch {
    aviso.textContent = 'Revisa el correo.';
  }
  aviso.hidden = false;
});

// Arranque -----------------------------------------------------------------

(async function iniciar() {
  try {
    yo = await api('/admin/api/yo');
  } catch {
    return;
  }
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  $('#yo-nombre').textContent = yo.nombre;
  for (const el of document.querySelectorAll('[data-solo-admin]')) el.hidden = yo.rol !== 'admin';
  $('#app').hidden = false;
  cargarConteos();
  vista();
})();
