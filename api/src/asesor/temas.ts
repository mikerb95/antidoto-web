// Tema de cada pregunta al asesor, por palabras clave y sin modelo (no cuesta nada). Sirve para
// ver en el panel qué pregunta más la gente. Gana el primer tema que coincide, en este orden.
//
// Módulo PURO.

export const TEMAS = ['precio', 'cotizacion', 'fechas', 'lugar', 'grupo', 'formato', 'contacto', 'servicios', 'otro'] as const;
export type Tema = (typeof TEMAS)[number];

const REGLAS: [Exclude<Tema, 'otro'>, RegExp][] = [
  ['precio', /\b(precio|precios|cu[aá]nto (cuesta|vale|sale|cobran)|costo|costos|valor|tarifa|presupuesto|price|pricing|cost|how much|budget|rate)\b/i],
  ['cotizacion', /\b(cotiza\w*|propuesta|quote|proposal|estimate)\b/i],
  ['fechas', /\b(fecha|fechas|cu[aá]ndo|disponib\w*|agenda|mes|semana|date|dates|when|availab\w*|schedule)\b/i],
  ['lugar', /\b(ciudad|ciudades|d[oó]nde|bogot[aá]|medell[ií]n|cali|barranquilla|cartagena|bucaramanga|lugar|sede|viajan|city|cities|where|location|travel)\b/i],
  ['grupo', /\b(personas|participantes|asistentes|grupo|grupos|equipo de \w+|colaboradores|empleados|people|participants|attendees|group|team size|employees)\b/i],
  ['formato', /\b(virtual|presencial|online|remot\w*|duraci[oó]n|horas|d[ií]as|formato|modalidad|idioma|ingl[eé]s|in person|duration|hours|format|language)\b/i],
  ['contacto', /\b(whatsapp|llamar|tel[eé]fono|correo|contacto|hablar con|asesor humano|contact|call|phone|email|talk to)\b/i],
  ['servicios', /\b(qu[eé] (hacen|ofrecen|incluye)|servicio|servicios|formaci[oó]n|video|catering|dise[nñ]o|capacitaci[oó]n|services?|offer|include|training|workshop)\b/i],
];

export function temaDe(texto: string): Tema {
  for (const [tema, re] of REGLAS) if (re.test(texto)) return tema;
  return 'otro';
}
