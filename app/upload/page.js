'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const xhrRef = useRef(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setProgress(0);
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
        xhrRef.current = xhr;
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (status ${xhr.status})`));
        xhr.onerror = () => reject(new Error('Upload failed — check R2 CORS settings'));
        xhr.onabort = () => reject(new Error('CANCELLED'));
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
      if (err.message === 'CANCELLED') {
        setStatus('Upload cancelled');
      } else {
        setStatus(err.message);
      }
      setBusy(false);
      setProgress(0);
      xhrRef.current = null;
    }
  }

  function handleCancel() {
    if (xhrRef.current) xhrRef.current.abort();
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
          disabled={busy}
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
          disabled={busy}
          style={{ color: '#ccc' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={!file || busy}
            style={{
              flex: 1,
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
          {busy && (
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '0.7rem 1rem',
                background: 'transparent',
                color: '#e77',
                border: '1px solid #e77',
                borderRadius: 6,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {status && (
          <p style={{ color: '#999', fontSize: '0.9rem' }}>
            {status} {progress > 0 && progress < 100 ? `(${progress}%)` : ''}
          </p>
        )}
        {busy && progress > 0 && (
          <div style={{ height: 4, background: '#222', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: '#fff',
                transition: 'width 0.2s',
              }}
            />
          </div>
        )}
      </form>
    </main>
  );
}
