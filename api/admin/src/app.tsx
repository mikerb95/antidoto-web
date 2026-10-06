// Armazón del panel: acceso, barra lateral por grupos, barra superior con buscador (Ctrl+K) y
// menú de la cuenta, y la pantalla de la ruta actual.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, cuandoSePierdaLaSesion } from './api';
import { navegar, rutaDeHashViejo, useUbicacion } from './ruteo';
import { SesionCtx, type Yo } from './sesion';
import { NAV, RUTAS } from './rutas';
import { ROLES } from './textos';
import { Icono } from './ui/iconos';
import { AnfitrionAvisos, AnfitrionDialogos } from './ui/dialogos';
import { Cargando, Vacio } from './ui/base';
import { BuscadorGlobal } from './vistas/BuscadorGlobal';
import Entrar from './vistas/Entrar';

export function App() {
  const [yo, setYo] = useState<Yo | null | undefined>(undefined);
  const { ruta } = useUbicacion();

  useEffect(() => {
    const viejo = rutaDeHashViejo(location.hash);
    if (viejo) navegar(viejo, { reemplazar: true });
    cuandoSePierdaLaSesion(() => setYo(null));
    api<Yo>('/admin/api/yo')
      .then(setYo)
      .catch(() => setYo(null));
  }, []);

  if (ruta.startsWith('/admin/entrar') || yo === null) return <Entrar alEntrar={setYo} />;
  if (yo === undefined)
    return (
      <div class="arranque">
        <Cargando texto="Abriendo el panel" />
      </div>
    );
  return (
    <SesionCtx.Provider value={yo}>
      <Marco yo={yo} ruta={ruta} />
      <AnfitrionDialogos />
      <AnfitrionAvisos />
    </SesionCtx.Provider>
  );
}

function Marco({ yo, ruta }: { yo: Yo; ruta: string }) {
  const [menu, setMenu] = useState(false);
  const [buscar, setBuscar] = useState(false);
  const encontrada = RUTAS.map((r) => ({ r, m: ruta.match(r.patron) })).find((x) => x.m);
  const permitida = encontrada && (!encontrada.r.permiso || yo.permisos.includes(encontrada.r.permiso));
  const Vista = encontrada?.r.vista;

  useEffect(() => {
    document.title = `${encontrada?.r.titulo ?? 'Panel'} · Antídoto`;
    setMenu(false);
  }, [ruta]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscar(true);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  return (
    <div class="marco">
      <a class="saltar" href="#principal">
        Saltar al contenido
      </a>
      <aside class={`lateral-nav${menu ? ' abierta' : ''}`} id="navegacion">
        <a class="marca" href="/admin/">
          <span class="marca-nombre">Antídoto</span>
          <span class="marca-sub">Panel</span>
        </a>
        <nav aria-label="Secciones del panel">
          {NAV.map((g) => {
            const entradas = g.entradas.filter((e) => !e.permiso || yo.permisos.includes(e.permiso));
            if (!entradas.length) return null;
            return (
              <div class="nav-grupo">
                <p class="nav-titulo">{g.grupo}</p>
                <ul>
                  {entradas.map((e) => (
                    <li>
                      <a class="nav-enlace" href={e.href} aria-current={encontrada?.r.nav === e.clave ? 'page' : undefined}>
                        <Icono nombre={e.icono} />
                        <span>{e.texto}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
      {menu && <button type="button" class="velo" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
      <div class="principal">
        <header class="superior">
          <button type="button" class="boton-icono menu-movil" aria-expanded={menu} aria-controls="navegacion" onClick={() => setMenu(!menu)}>
            <Icono nombre="menu" />
            <span class="sr">Menú</span>
          </button>
          <button type="button" class="abrir-buscador" onClick={() => setBuscar(true)} aria-keyshortcuts="Control+K">
            <Icono nombre="buscar" />
            <span>Buscar en el panel</span>
            <kbd>Ctrl K</kbd>
          </button>
          <MenuCuenta yo={yo} />
        </header>
        <main id="principal" class="contenido" tabIndex={-1}>
          {!encontrada ? (
            <Vacio titulo="Esta página no existe" accion={<a href="/admin/">Volver al inicio</a>} />
          ) : !permitida ? (
            <Vacio titulo="Tu rol no tiene acceso a esta sección">Pídele a una persona con rol Admin que te dé acceso si lo necesitas.</Vacio>
          ) : (
            Vista && <Vista key={encontrada.r.nav + ruta} params={encontrada.m!.slice(1).filter(Boolean) as string[]} />
          )}
        </main>
      </div>
      {buscar && <BuscadorGlobal alCerrar={() => setBuscar(false)} />}
    </div>
  );
}

function MenuCuenta({ yo }: { yo: Yo }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: Event) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);
  const salir = async (todas = false) => {
    await api(`/auth/salir${todas ? '?todas=1' : ''}`, { method: 'POST' }).catch(() => null);
    location.href = '/admin/';
  };
  const iniciales = yo.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div class="cuenta" ref={caja}>
      <button type="button" class="cuenta-boton" aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto(!abierto)}>
        <span class="avatar" aria-hidden="true">
          {iniciales}
        </span>
        <span class="cuenta-texto">
          <span class="cuenta-nombre">{yo.nombre}</span>
          <span class="cuenta-rol">{ROLES[yo.rol]?.nombre ?? yo.rol}</span>
        </span>
      </button>
      {abierto && (
        <div class="cuenta-menu">
          <p class="cuenta-email">{yo.email}</p>
          <a href="/admin/cuenta" onClick={() => setAbierto(false)}>
            <Icono nombre="cuenta" /> Mi cuenta y sesiones
          </a>
          <button type="button" onClick={() => salir()}>
            <Icono nombre="salir" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
