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
  const nombre = ID.test(hash) ? 'leads' : ['leads', 'metricas', 'equipo'].includes(hash) ? hash : 'leads';
  if (nombre === 'equipo' && yo.rol !== 'admin') return (location.hash = '#leads');
  for (const v of document.querySelectorAll('.vista')) v.hidden = v.id !== `vista-${nombre}`;
  for (const a of document.querySelectorAll('[data-vista]')) {
    if (a.dataset.vista === nombre) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (nombre === 'leads') {
    cargarLeads();
    if (ID.test(hash)) abrirLead(hash);
    else $('#detalle').hidden = true;
  }
  if (nombre === 'metricas') cargarMetricas();
  if (nombre === 'equipo') cargarEquipo();
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
