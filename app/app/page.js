import './globals.css';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '1.8rem', fontWeight: 500 }}>SRJ Screen Test</h1>
      <p style={{ marginTop: '0.75rem', color: '#999' }}>
        Scaffold deployed. Build in progress.
      </p>
    </main>
  );
}
