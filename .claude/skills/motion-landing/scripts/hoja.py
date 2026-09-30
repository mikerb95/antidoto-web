#!/usr/bin/env python3
"""Hoja de contactos: junta varias capturas en una sola imagen para revisar una
secuencia de animación (o varias secciones) de un vistazo.

Uso:
  python3 hoja.py salida.png img1.png img2.png ... [--ancho 480] [--cols 3]

Cada imagen se escala al mismo ancho (--ancho) manteniendo su proporción y se
coloca en una rejilla de --cols columnas sobre fondo gris, con 20 px de separación.
Requiere Pillow (pip install pillow).
"""
import argparse

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("salida")
    ap.add_argument("imagenes", nargs="+")
    ap.add_argument("--ancho", type=int, default=480)
    ap.add_argument("--cols", type=int, default=3)
    a = ap.parse_args()

    imgs = []
    for ruta in a.imagenes:
        im = Image.open(ruta).convert("RGB")
        alto = round(im.height * a.ancho / im.width)
        imgs.append(im.resize((a.ancho, alto)))

    sep = 20
    cols = max(1, min(a.cols, len(imgs)))
    filas = [imgs[i : i + cols] for i in range(0, len(imgs), cols)]
    altos = [max(im.height for im in fila) for fila in filas]
    lienzo = Image.new(
        "RGB",
        (cols * a.ancho + (cols - 1) * sep, sum(altos) + (len(filas) - 1) * sep),
        (40, 40, 40),
    )
    y = 0
    for fila, alto in zip(filas, altos):
        for k, im in enumerate(fila):
            lienzo.paste(im, (k * (a.ancho + sep), y))
        y += alto + sep
    lienzo.save(a.salida)
    print(a.salida, lienzo.size)


if __name__ == "__main__":
    main()
