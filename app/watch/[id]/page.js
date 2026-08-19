'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function WatchPage() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const sessionIdRef = useRef(null);
  const seekFromRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data: videoRow, error: videoErr } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (videoErr || !videoRow) {
        setError('Video not found');
        return;
      }
      if (cancelled) return;
      setVideo(videoRow);

      const res = await fetch('/api/watch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey: videoRow.storage_key }),
      });
      if (!res.ok) {
        setError('Could not load video from storage');
        return;
      }
      const { playbackUrl: url } = await res.json();
      if (cancelled) return;
      setPlaybackUrl(url);

      const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .insert({ video_id: id, user_agent: navigator.userAgent })
        .select()
        .single();

      if (!sessionErr && session) {
        sessionIdRef.current = session.id;
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function logEvent(eventType, metadata) {
    const sessionId = sessionIdRef.current;
    const v = videoRef.current;
    if (!sessionId || !v) return;
    supabase
      .from('playback_events')
      .insert({
        session_id: sessionId,
        event_type: eventType,
        video_time_seconds: v.currentTime || 0,
        metadata: metadata || null,
      })
      .then(({ error: err }) => {
        if (err) console.error('event log failed', err);
      });
  }

  useEffect(() => {
    function handleVisibility() {
      logEvent(document.hidden ? 'tab_blur' : 'tab_focus');
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: '2.5rem auto', padding: '0 1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ fontSize: '1.3rem', fontWeight: 500 }}>{video ? video.title : 'Loading...'}</h1>
        <Link href="/" style={{ color: '#777', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← All videos
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: '2rem',
            background: '#1a1010',
            border: '1px solid #442222',
            borderRadius: 10,
            color: '#e88',
          }}
        >
          {error}
        </div>
      )}

      {!error && (
        <div
          style={{
            background: '#111214',
            border: '1px solid #26272a',
            borderRadius: 12,
            padding: playbackUrl ? 8 : 0,
            overflow: 'hidden',
          }}
        >
          {playbackUrl ? (
            <video
              ref={videoRef}
              src={playbackUrl}
              controls
              style={{ width: '100%', display: 'block', borderRadius: 6, background: '#000' }}
              onPlay={() => logEvent('play')}
              onPause={() => logEvent('pause')}
              onSeeking={(e) => {
                seekFromRef.current = e.currentTarget.dataset.lastTime
                  ? parseFloat(e.currentTarget.dataset.lastTime)
                  : null;
              }}
              onSeeked={(e) => {
                logEvent('seek', { from: seekFromRef.current, to: e.currentTarget.currentTime });
              }}
              onTimeUpdate={(e) => {
                e.currentTarget.dataset.lastTime = e.currentTarget.currentTime;
              }}
              onWaiting={() => logEvent('buffering')}
              onEnded={() => {
                logEvent('ended');
                const sessionId = sessionIdRef.current;
                if (sessionId) {
                  supabase
                    .from('sessions')
                    .update({ ended_at: new Date().toISOString() })
                    .eq('id', sessionId)
                    .then(() => {});
                }
              }}
            />
          ) : (
            <div
              style={{
                aspectRatio: '16 / 9',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                color: '#555',
                fontSize: '0.9rem',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: '2px solid #2a2a2a',
                  borderTopColor: '#888',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Loading video…</span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
