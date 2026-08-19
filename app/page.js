import './globals.css';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <main style={{ maxWidth: 720, margin: '3rem auto', padding: '0 1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.6rem', fontWeight: 500 }}>SRJ Screen Test</h1>
        <Link
          href="/upload"
          style={{
            padding: '0.5rem 1rem',
            background: '#fff',
            color: '#000',
            borderRadius: 6,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          + Upload video
        </Link>
      </div>
      {(!videos || videos.length === 0) && (
        <p style={{ color: '#999' }}>No videos yet. Upload one to start a screening.</p>
      )}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {videos &&
          videos.map((v) => (
            <li key={v.id}>
              <Link
                href={`/watch/${v.id}`}
                style={{
                  display: 'block',
                  padding: '1rem',
                  background: '#141414',
                  borderRadius: 8,
                  color: '#fff',
                  textDecoration: 'none',
                }}
              >
                {v.title || v.storage_key}
              </Link>
            </li>
          ))}
      </ul>
    </main>
  );
}
