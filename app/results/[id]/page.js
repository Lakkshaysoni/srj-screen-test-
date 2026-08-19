'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { supabase } from '../../../lib/supabase';

const BUCKET_SECONDS = 10;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ResultsPage() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: videoRow, error: videoErr } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (videoErr || !videoRow) {
        setError('Video not found');
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setVideo(videoRow);

      const { data: sessionRows } = await supabase
        .from('sessions')
        .select('*')
        .eq('video_id', id)
        .order('started_at', { ascending: false });

      if (cancelled) return;
      const sessionList = sessionRows || [];
      setSessions(sessionList);

      const sessionIds = sessionList.map((s) => s.id);
      if (sessionIds.length > 0) {
        const { data: eventRows } = await supabase
          .from('playback_events')
          .select('*')
          .in('session_id', sessionIds)
          .order('video_time_seconds', { ascending: true });
        if (!cancelled) setEvents(eventRows || []);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const chartData = useMemo(() => {
    if (events.length === 0) return [];
    const maxTime = Math.max(...events.map((e) => e.video_time_seconds), 0);
    const bucketCount = Math.ceil((maxTime + 1) / BUCKET_SECONDS) || 1;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      label: formatTime(i * BUCKET_SECONDS),
      pause: 0,
      seek: 0,
      tab_blur: 0,
      buffering: 0,
    }));

    events.forEach((e) => {
      const idx = Math.min(Math.floor(e.video_time_seconds / BUCKET_SECONDS), bucketCount - 1);
      if (idx < 0) return;
      if (buckets[idx][e.event_type] !== undefined) buckets[idx][e.event_type] += 1;
    });

    return buckets;
  }, [events]);

  const finishedCount = sessions.filter((s) => s.ended_at).length;

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: '3rem auto', padding: '0 1.5rem', color: '#777' }}>
        Loading results…
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 900, margin: '3rem auto', padding: '0 1.5rem' }}>
        <p style={{ color: '#e88' }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: '2.5rem auto', padding: '0 1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.3rem',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 500 }}>{video?.title || 'Results'}</h1>
        <Link href="/" style={{ color: '#777', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← All videos
        </Link>
      </div>
      <p style={{ color: '#888', marginBottom: '2rem', fontSize: '0.9rem' }}>
        {sessions.length} session{sessions.length === 1 ? '' : 's'} · {finishedCount} finished
      </p>

      {sessions.length === 0 ? (
        <p style={{ color: '#999' }}>No one has watched this yet.</p>
      ) : (
        <>
          <section
            style={{
              background: '#111214',
              border: '1px solid #26272a',
              borderRadius: 12,
              padding: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            <h2 style={{ fontSize: '0.95rem', fontWeight: 500, marginBottom: '1rem', color: '#ccc' }}>
              Drop-off signals over time
            </h2>
            {chartData.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.85rem' }}>
                No pause/seek/tab-switch events logged yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#26272a" />
                  <XAxis dataKey="label" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#ccc' }}
                  />
                  <Bar dataKey="pause" stackId="a" fill="#d97757" name="Pause" />
                  <Bar dataKey="seek" stackId="a" fill="#e8b34a" name="Seek" />
                  <Bar dataKey="tab_blur" stackId="a" fill="#e2534a" name="Tab switched away" />
                  <Bar dataKey="buffering" stackId="a" fill="#555" name="Buffering" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            <p style={{ color: '#666', fontSize: '0.78rem', marginTop: '0.75rem' }}>
              Taller bars = more viewers paused, rewound, switched tabs, or stalled around that point.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 500, marginBottom: '0.75rem', color: '#ccc' }}>
              Sessions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.map((s) => {
                const sessionEvents = events.filter((e) => e.session_id === s.id);
                const lastTime = sessionEvents.length
                  ? Math.max(...sessionEvents.map((e) => e.video_time_seconds))
                  : 0;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: '#141414',
                      border: '1px solid #232323',
                      borderRadius: 8,
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ color: '#ccc' }}>{new Date(s.started_at).toLocaleString()}</span>
                    <span style={{ color: s.ended_at ? '#7bc47f' : '#999' }}>
                      {s.ended_at ? 'Finished' : `Reached ${formatTime(lastTime)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
