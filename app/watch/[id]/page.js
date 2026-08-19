'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
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
    <main style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 500, marginBottom: '1rem' }}>
        {video ? video.title : 'Loading...'}
      </h1>
      {error && <p style={{ color: '#e55' }}>{error}</p>}
      {playbackUrl && (
        <video
          ref={videoRef}
          src={playbackUrl}
          controls
          style={{ width: '100%', borderRadius: 8, background: '#000' }}
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
      )}
    </main>
  );
}
