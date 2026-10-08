import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { MarcoPublico } from '../src/components/layout/marco-publico';
import './globals.css';

// Dos voces: Shippori Mincho para el nombre, las fechas y los títulos (tinta de pincel sobre
// madera) y Zen Kaku Gothic New para la interfaz. Ambas tienen licencia OFL (los textos están
// en src/fonts) y se sirven desde el propio sitio: no dependen de Google en tiempo de ejecución.
// Cada archivo es un subconjunto: latín, hiragana (いちご) y los kanji 予 y 満 de los sellos;
// cualquier otro carácter japonés cae a las fuentes del sistema (ver `--font-display`).
const mincho = localFont({
  variable: '--font-mincho',
  display: 'swap',
  src: [
    { path: '../src/fonts/mincho-400.woff', weight: '400', style: 'normal' },
    { path: '../src/fonts/mincho-500.woff', weight: '500', style: 'normal' },
    { path: '../src/fonts/mincho-700.woff', weight: '700', style: 'normal' },
  ],
});

// Solo para el nombre «Ichigo»: Yuji Syuku (OFL), de trazo de pincel, recortada a esas letras.
const marca = localFont({
  variable: '--font-marca',
  display: 'swap',
  src: [{ path: '../src/fonts/marca.woff', weight: '400', style: 'normal' }],
});

const gothic = localFont({
  variable: '--font-gothic',
  display: 'swap',
  src: [
    { path: '../src/fonts/gothic-400.woff', weight: '400', style: 'normal' },
    { path: '../src/fonts/gothic-500.woff', weight: '500', style: 'normal' },
    { path: '../src/fonts/gothic-700.woff', weight: '700', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: {
    default: 'Ichigo',
    template: '%s | Ichigo',
  },
  description:
    'Reservá tu lugar en Ichigo, restaurante japonés de omakase. Elegí fecha y turno, y recibí un código para consultar o cancelar tu reserva.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es-AR"
      className={`${mincho.variable} ${gothic.variable} ${marca.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <MarcoPublico>{children}</MarcoPublico>
      </body>
    </html>
  );
}
