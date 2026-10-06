// Acceso con enlace mágico. El correo trae /auth/entrar?t=..., que redirige aquí con el token en
// el fragmento (#t=...): el fragmento no viaja al servidor ni queda en el Referer. El enlace se
// gasta solo al pulsar "Entrar", así los filtros de correo que abren enlaces no lo consumen.
import { useState } from 'preact/hooks';
import type { Yo } from '../sesion';

export default function Entrar(_: { alEntrar?: (yo: Yo) => void }) {
  const token = new URLSearchParams(location.hash.slice(1)).get('t');
  const error = new URLSearchParams(location.search).get('error');
  const [enviado, setEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const pedir = async (e: Event) => {
    e.preventDefault();
    setOcupado(true);
    const email = new FormData(e.target as HTMLFormElement).get('email');
    await fetch('/auth/enlace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null);
    setOcupado(false);
    setEnviado(true);
  };

  return (
    <main class="entrar">
      <div class="entrar-caja">
        <p class="marca-nombre">Antídoto</p>
        {token ? (
          <>
            <h1>Entrar al panel</h1>
            <p class="suave">Confirma para abrir tu sesión en este navegador.</p>
            <form method="post" action="/auth/entrar">
              <input type="hidden" name="t" value={token} />
              <button class="btn btn-primario btn-bloque" type="submit">
                Entrar
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Panel de administración</h1>
            <p class="suave">Escribe tu correo del equipo y te enviamos un enlace para entrar. No hay contraseñas.</p>
            {error === 'enlace' && !enviado && (
              <div class="aviso aviso-alerta" role="status">
                El enlace venció o ya se usó. Pide uno nuevo.
              </div>
            )}
            {enviado ? (
              <div class="aviso aviso-exito" role="status">
                Si el correo es del equipo, te llega un enlace en un minuto. Vence en 15 minutos y sirve una sola vez.
              </div>
            ) : (
              <form onSubmit={pedir}>
                <label class="campo">
                  <span class="campo-etq">Correo</span>
                  <input name="email" type="email" autocomplete="email" required autoFocus />
                </label>
                <button class="btn btn-primario btn-bloque" type="submit" disabled={ocupado}>
                  {ocupado ? 'Enviando' : 'Enviarme el enlace'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
