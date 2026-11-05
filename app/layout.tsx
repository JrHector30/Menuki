import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Menuki | Catálogo Digital & Pedidos',
  description: 'Catálogo digital y recepción de pedidos por WhatsApp para negocios locales.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-neutral-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
