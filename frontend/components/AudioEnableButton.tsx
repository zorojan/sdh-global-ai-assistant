import React, { useEffect, useState } from 'react';
import { audioContext } from '../lib/utils';

export default function AudioEnableButton() {
  const [state, setState] = useState<string>('unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Try to obtain the shared audio context and report its state
    audioContext({ id: 'audio-out-widget' })
      .then((ctx) => {
        if (!mounted) return;
        setState(ctx.state || 'unknown');
        const listener = () => setState(ctx.state || 'unknown');
        try { ctx.addEventListener('statechange', listener); } catch (e) {}
        return () => {
          try { ctx.removeEventListener('statechange', listener); } catch (e) {}
        };
      })
      .catch(() => {
        if (!mounted) return;
        setState('unavailable');
      });
    return () => { mounted = false; };
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const ctx = await audioContext({ id: 'audio-out-widget' });
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      setState(ctx.state || 'unknown');
      // create short silent playback to ensure autoplay unblock
      try {
        const a = new Audio();
        a.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        a.play().catch(()=>{});
      } catch (e) {}
    } catch (e) {
      console.warn('AudioEnableButton: failed to enable audio', e);
      setState('error');
    } finally {
      setLoading(false);
    }
  };

  const label = state === 'running' ? 'Audio enabled' : state === 'suspended' ? 'Enable audio' : state === 'unknown' ? 'Enable audio' : state === 'unavailable' ? 'Audio unavailable' : 'Enable audio';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleEnable}
        disabled={loading || state === 'running' || state === 'unavailable'}
        style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
      >
        {loading ? '⏳' : state === 'running' ? '🔊' : '🔈'} {label}
      </button>
      <div style={{ fontSize: 12, color: '#666' }}>{state}</div>
    </div>
  );
}
