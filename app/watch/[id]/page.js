'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const SKIP_SECONDS = 10;

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#ddd',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function formatTime(t) {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WatchPage() {
  const { id } = useParams();
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const sessionIdRef = useRef(null);

  const [video, setVideo] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [error, setError] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

      if (!sessionErr && session) sessionIdRef.current = session.id;
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const logEvent = useCallback((eventType, metadata) => {
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
  }, []);

  useEffect(() => {
    function handleVisibility() {
      logEvent(document.hidden ? 'tab_blur' : 'tab_focus');
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [logEvent]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  const skip = useCallback(
    (delta) => {
      const v = videoRef.current;
      if (!v) return;
      const from = v.currentTime;
      const to = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
      v.currentTime = to;
      logEvent('seek', { from, to, via: delta > 0 ? 'skip_forward' : 'skip_back' });
    },
    [logEvent]
  );

  // Arrow-key skip + spacebar play/pause, works anywhere on the page (no need to click the player first)
  useEffect(() => {
    function handleKey(e) {
      if (!videoRef.current) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        skip(SKIP_SECONDS);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skip(-SKIP_SECONDS);
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [skip]);

  function handleSeekBarClick(e) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const from = v.currentTime;
    const to = ratio * duration;
    v.currentTime = to;
    logEvent('seek', { from, to, via: 'scrubber' });
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
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
          ref={containerRef}
          style={{
            background: '#000',
            border: '1px solid #26272a',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {playbackUrl ? (
            <>
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={togglePlay}>
                <video
                  ref={videoRef}
                  src={playbackUrl}
                  style={{ width: '100%', display: 'block', background: '#000', aspectRatio: '16 / 9' }}
                  onPlay={() => {
                    setIsPlaying(true);
                    logEvent('play');
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                    logEvent('pause');
                  }}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onTimeUpdate={(e) => {
                    setCurrentTime(e.currentTarget.currentTime);
                    const buf = e.currentTarget.buffered;
                    if (buf.length > 0) setBuffered(buf.end(buf.length - 1));
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
                {!isPlaying && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.25)',
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={28} color="#000" fill="#000" style={{ marginLeft: 3 }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '0.6rem 0.8rem', background: '#0d0d0e' }}>
                <div
                  onClick={handleSeekBarClick}
                  style={{
                    height: 6,
                    background: '#2a2a2a',
                    borderRadius: 3,
                    cursor: 'pointer',
                    position: 'relative',
                    marginBottom: '0.65rem',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${duration ? (buffered / duration) * 100 : 0}%`,
                      background: '#3a3a3a',
                      borderRadius: 3,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      background: '#fff',
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                  <button onClick={togglePlay} style={iconBtnStyle} aria-label={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button onClick={() => skip(-SKIP_SECONDS)} style={iconBtnStyle} aria-label="Back 10 seconds">
                    <RotateCcw size={17} />
                  </button>
                  <button onClick={() => skip(SKIP_SECONDS)} style={iconBtnStyle} aria-label="Forward 10 seconds">
                    <RotateCw size={17} />
                  </button>
                  <span style={{ color: '#999', fontSize: '0.8rem', minWidth: 90 }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (v) {
                        v.muted = !v.muted;
                        setIsMuted(v.muted);
                      }
                    }}
                    style={iconBtnStyle}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                  </button>
                  <button onClick={toggleFullscreen} style={iconBtnStyle} aria-label="Fullscreen">
                    {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                  </button>
                </div>
              </div>
            </>
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

      <p style={{ color: '#555', fontSize: '0.78rem', marginTop: '0.75rem' }}>
        Tip: ← → skips {SKIP_SECONDS}s, space bar plays/pauses.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
