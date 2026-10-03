// Suscripción a novedades: la comparten el formulario del pie y la sección de la home. Envía a la
// API y la persona confirma desde su correo (doble confirmación). Al enviar el formulario acepta
// el texto de autorización que tiene debajo. Sin JS el formulario sigue oculto: no hay a dónde
// enviarlo sin fetch.
import { ui } from '../i18n/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function iniciarNovedades(form: HTMLFormElement): void {
  const locale = document.documentElement.lang.startsWith('es') ? 'es' : 'en';
  const s = ui[locale];
  const estado = form.querySelector<HTMLElement>('[data-estado]')!;
  const email = form.querySelector<HTMLInputElement>('input[name="email"]')!;
  const inicio = Date.now();
  // La sección de la home se muestra entera; el pie solo destapa el formulario.
  (form.closest<HTMLElement>('[data-novedades-caja]') ?? form).hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!EMAIL.test(email.value.trim())) {
      estado.textContent = s.novedadesError;
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      return;
    }
    email.removeAttribute('aria-invalid');
    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    boton.disabled = true;
    try {
      const r = await fetch(`${form.dataset.api}/v1/suscripciones`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          email: email.value.trim(),
          consentimiento: form.dataset.version,
          intereses: [...form.querySelectorAll<HTMLInputElement>('input[name="intereses"]:checked')].map((i) => i.value),
          web: (form.elements.namedItem('web') as HTMLInputElement).value,
          locale,
          pagina: location.pathname,
          t: Date.now() - inicio,
        }),
      });
      if (r.status === 429) {
        estado.textContent = s.novedadesLimite;
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      estado.textContent = s.novedadesEnviado;
      form.reset();
    } catch {
      estado.textContent = s.novedadesError;
    } finally {
      boton.disabled = false;
    }
  });
}
