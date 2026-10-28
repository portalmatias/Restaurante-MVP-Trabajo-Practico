# Tipografías de Ichigo

Las tres familias están auto-hosteadas (`next/font/local`, ver `app/layout.tsx` y
`app/global-error.tsx`): no se piden a ningún servicio externo ni al compilar ni al ejecutar. Son
subconjuntos recortados de las fuentes originales, todas con licencia SIL OFL 1.1.

| Archivo | Familia y peso | Uso | Licencia |
|---|---|---|---|
| `mincho-400.woff`, `mincho-500.woff`, `mincho-700.woff` | Shippori Mincho: Regular, Medium y Bold | títulos, fechas y el nombre (`font-display`) | `OFL-ShipporiMincho.txt` |
| `gothic-400.woff`, `gothic-500.woff`, `gothic-700.woff` | Zen Kaku Gothic New: Regular, Medium y Bold | interfaz y texto corrido (`font-sans`) | `OFL-ZenKakuGothicNew.txt` |
| `marca.woff` | Yuji Syuku Regular | solo el nombre «Ichigo» e «いちご» (`font-wordmark`) | `OFL-YujiSyuku.txt` |

Orígenes (según el aviso de copyright de cada licencia): Shippori Mincho en
<https://github.com/fontdasu/ShipporiMincho>, Zen Kaku Gothic New en
<https://github.com/googlefonts/zen-kakugothic> y Yuji Syuku en
<https://github.com/Kinutafontfactory/Yuji>.

## Qué caracteres traen

Los tres pesos de una misma familia traen exactamente los mismos caracteres. La cobertura es la que
mide `test/app/tipografias-glifos.test.ts` leyendo la tabla `cmap` de cada archivo; si cambia un
subconjunto, ese test lo avisa.

- **Shippori Mincho (`mincho-*`): 332 caracteres.** Latín-1 completo (`U+0020–007E` y
  `U+00A0–00FF`, o sea las vocales con tilde, la ñ, la ü y los signos ¿ ¡ « »), `ı`, `Œ`, `œ`,
  la puntuación tipográfica (guiones, comillas rectas y curvas, `†`, `‡`, `•`, `…`, `′`, `″`, `‹`,
  `›`), `€`, las flechas `← ↑ → ↓`, `、`, `。`, el hiragana completo, `ー` y 25 kanji: los de
  los días de la semana y los de las tablillas y el menú (予, 先付, 握, 甘味, 昼食, 夕食, 満, entre
  otros). Todo kanji que escribe el código tiene su glifo (lo verifica el test).
- **Zen Kaku Gothic New (`gothic-*`): 310 caracteres.** Latín-1 completo, `ı`, `Œ`, `œ`,
  `Ŵ ŵ Ŷ ŷ Ÿ`, puntuación (`‖`, `‰`, `№` además de la de arriba), `€`, las flechas, `、`, `。`, el
  hiragana, `ー`, y los kanji 予 y 満.
- **Yuji Syuku (`marca.woff`): 10 caracteres.** Solo lo necesario para «Ichigo» e «いちご»: espacio,
  `I`, `c`, `g`, `h`, `i`, `o`, `い`, `ち`, `ご`.

### Límites que conviene conocer

- Un nombre con letras de otro alfabeto latino (`Ł`, `ő`, `ř`, `ğ`) o con otra escritura no tiene
  glifo en el subconjunto: ese carácter se dibuja con la fuente del sistema (los `font-family`
  de `globals.css` traen una pila de respaldo). Para nombres en español y los apellidos habituales
  en la Argentina (acentos, ñ, ü, `ç`, `ï`, `ë`, `ö`) no hay problema.
- La marca (`marca.woff`) no sirve para otro texto: cualquier otra palabra en `font-wordmark` cae a
  Shippori Mincho, que es la siguiente de la pila.

## Cómo se generaron

**La herramienta y la lista original no quedaron registradas.** El commit que sumó los archivos
(`c443151`) dice que están «recortadas a los caracteres usados», pero no deja ningún script ni la
lista de caracteres, y las tablas `name` de los `.woff` no traen la cadena de versión que suelen
dejar las herramientas. Lo que sí se puede afirmar, midiéndolo, es qué caracteres contiene cada
archivo (arriba) y que:

- los archivos son WOFF 1.0 con contornos `glyf` (TrueType);
- tienen más glifos que caracteres (por ejemplo 941 glifos para 332 caracteres en Shippori Mincho)
  y conservan las tablas de maquetación (`GSUB`, `GPOS`, `GDEF`) y las métricas verticales
  (`vhea`, `vmtx`, necesarias para el japonés vertical de las tablillas). Es compatible con haber
  usado `pyftsubset`, pero no lo prueba.

### Cómo comprobarlos

Con [fonttools](https://fonttools.readthedocs.io/) (`pip install fonttools`):

```python
from fontTools.ttLib import TTFont
cmap = TTFont("mincho-400.woff").getBestCmap()
print(len(cmap))                         # 332
print("Ñ" in map(chr, cmap))             # True
```

Y sin instalar nada: `npm run test:frontend -- tipografias-glifos` mide la cobertura con los
nombres y textos reales (`Ñandú Pérez`, `Güemes`, `Córdoba`, `María Peña`, `Jean-François`, …) y
con todo carácter japonés que escribe el código.

### Cómo regenerarlos (receta propuesta; no es la original)

Hace falta bajar las fuentes originales (los repositorios de arriba) y recortarlas con
`pyftsubset`, de fonttools. Las listas de abajo se comprobaron así: aplicar `pyftsubset` con ellas
sobre cada `.woff` actual reproduce exactamente el mismo conjunto de caracteres. **No se comprobó**
que, aplicadas a las fuentes originales, den archivos idénticos byte a byte a los del repositorio.

```bash
# Shippori Mincho (repetir para cada peso)
pyftsubset ShipporiMincho-Regular.ttf --flavor=woff --output-file=mincho-400.woff \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2010,U+2013-2015,U+2018-201A,U+201C-201E,U+2020-2022,U+2025-2026,U+2032-2033,U+2039-203A,U+20AC,U+2190-2193,U+3001-3002,U+3041-3096,U+30FC,U+4E88,U+4ED8,U+5148,U+53F7,U+5473,U+571F,U+5831,U+5915,U+591C,U+5E2D,U+60C5,U+63E1,U+65E5,U+663C,U+6642,U+6708,U+6728,U+6C34,U+6E80,U+706B,U+7518,U+756A,U+9078,U+91D1,U+98DF"

# Zen Kaku Gothic New (repetir para cada peso)
pyftsubset ZenKakuGothicNew-Regular.ttf --flavor=woff --output-file=gothic-400.woff \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+0174-0178,U+2010,U+2013-2014,U+2016,U+2018-201A,U+201C-201E,U+2022,U+2025-2026,U+2030,U+2039-203A,U+20AC,U+2116,U+2190-2193,U+3001-3002,U+3041-3094,U+30FC,U+4E88,U+6E80"

# Yuji Syuku (solo la marca)
pyftsubset YujiSyuku-Regular.ttf --flavor=woff --output-file=marca.woff \
  --unicodes="U+0020,U+0049,U+0063,U+0067-0069,U+006F,U+3044,U+3054,U+3061"
```

Los nombres de los `.ttf` de origen dependen del repositorio y de la versión que se descargue.
Para sumar un carácter hay que agregarlo a la lista de la familia, regenerar los tres pesos y
actualizar la huella (la cantidad de caracteres) en este archivo y en
`test/app/tipografias-glifos.test.ts`. Todas las familias conservan su licencia OFL: el archivo
`OFL-*.txt` correspondiente tiene que seguir junto a los `.woff`.
