'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import './globals.css';

export default function Home() {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setVideos(data || []);
      });
  }, []);

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

      {error && <p style={{ color: '#e88' }}>Couldn't load videos: {error}</p>}
      {videos === null && !error && <p style={{ color: '#666' }}>Loading...</p>}
      {videos && videos.length === 0 && (
        <p style={{ color: '#999' }}>No videos yet. Upload one to start a screening.</p>
      )}

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {videos &&
          videos.map((v) => (
            <li key={v.id} style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                href={`/watch/${v.id}`}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#141414',
                  borderRadius: 8,
                  color: '#fff',
                  textDecoration: 'none',
                }}
              >
                {v.title || v.storage_key}
              </Link>
              <Link
                href={`/results/${v.id}`}
                style={{
                  padding: '1rem',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#ccc',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                View results
              </Link>
            </li>
          ))}
      </ul>
    </main>
  );
}
