# Marca Antídoto

Fuente de verdad para color y tipografía del sitio. Origen: `paleta-de-colores-antidoto.pdf` (guía entregada por el cliente).

## Color

| Token | Hex | Uso | Contraste sobre `#0F181D` | Contraste sobre blanco |
|---|---|---|---|---|
| `--glow` | `#80DCFF` | Luces del líquido, texto de acento sobre oscuro | 11,6:1 | 1,5:1 (no usar para texto) |
| `--antidote` | `#3BC8F3` | Color del logotipo y acento principal | 9,2:1 | 2,0:1 (no usar para texto) |
| `--mid` | `#1C99CA` | Degradados, estados hover, iconos | 5,5:1 | 3,3:1 (solo texto grande) |
| `--deep` | `#0C5C7D` | Superficies, bordes, fondo de secciones | 2,4:1 (no usar para texto) | 7,4:1 |
| `--ink` | `#0F181D` | Fondo base y texto sobre fondos claros | n/a | 18,0:1 |

Contraste calculado con la fórmula WCAG 2.2. AA exige 4,5:1 para texto normal y 3:1 para texto grande.

El sitio actual usa `#49C1EC` como cian. La guía oficial es `#3BC8F3`: el nuevo sitio usa el de la guía.

Fuera de la paleta solo se permite un acento cálido (`--reto`) para representar problemas en la narrativa de retos a soluciones, y el verde de WhatsApp dentro de su icono.

## Tipografía

| Fuente | Uso en el sitio |
|---|---|
| Cal Sans | Títulos y display. Solo su peso real, sin negritas sintéticas |
| Poppins | Texto corriente e interfaz. Pesos 400, 500 y 600 |
| Modulus | Acento de marca en tamaños grandes (cifras, palabras sueltas). Nunca en párrafos ni por debajo de 20 px |

Todas se sirven en WOFF2 con subset latino y `preload` de la display.

## Logotipo

El wordmark "antidoto" en `#3BC8F3`: las dos "o" centrales forman un infinito y la última se convierte en un frasco con nivel de líquido. Reglas de uso en `../auditoria/02-prompt-claude-design.md` §3.1.
