import Link from 'next/link'

/**
 * Reached only for paths outside the localized tree, where no messages are
 * loaded, so this one stays deliberately language-neutral.
 */
export default function RootNotFound() {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>404</h1>
          <p style={{ color: '#64748b', marginTop: '.5rem' }}>
            No encontrado · Not found · Não encontrado
          </p>
          <p style={{ marginTop: '1rem' }}>
            <Link href="/es" style={{ color: '#2563eb' }}>
              Protocolo BIM
            </Link>
          </p>
        </div>
      </body>
    </html>
  )
}
