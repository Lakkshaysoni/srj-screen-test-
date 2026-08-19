'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setStatus('Requesting upload slot...');

    try {
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, storageKey } = await res.json();

      setStatus('Uploading...');
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      setStatus('Saving...');
      const { data, error } = await supabase
        .from('videos')
        .insert({ title: title || file.name, storage_key: storageKey })
        .select()
        .single();

      if (error) throw new Error('Failed to save video record: ' + error.message);

      router.push(`/watch/${data.id}`);
    } catch (err) {
      setStatus(err.message);
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '1.5rem' }}>
        Upload a test video
      </h1>
      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            padding: '0.6rem',
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#fff',
            borderRadius: 6,
          }}
        />
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ color: '#ccc' }}
        />
        <button
          type="submit"
          disabled={!file || busy}
          style={{
            padding: '0.7rem',
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            fontWeight: 500,
            cursor: file && !busy ? 'pointer' : 'not-allowed',
            opacity: file && !busy ? 1 : 0.5,
          }}
        >
          Upload
        </button>
        {status && (
          <p style={{ color: '#999', fontSize: '0.9rem' }}>
            {status} {progress > 0 && progress < 100 ? `(${progress}%)` : ''}
          </p>
        )}
      </form>
    </main>
  );
}
