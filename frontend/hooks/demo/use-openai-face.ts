/**
 * OpenAI Realtime Face Hook - Similar to useFace but for OpenAI volume data
 */
import { useEffect, useRef, useState } from 'react';
import { useOpenAIRealtimeContext } from '../../contexts/OpenAIRealtimeContext';

export type OpenAIFaceResults = {
  /** A value that represents how open the eyes are. */
  eyeScale: number;
  /** A value that represents how open the mouth is. */
  mouthScale: number;
};

function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
}

// Constrain value between lower and upper limits
function clamp(x: number, lowerlimit: number, upperlimit: number) {
  if (x < lowerlimit) x = lowerlimit;
  if (x > upperlimit) x = upperlimit;
  return x;
}

// GLSL smoothstep implementation
function smoothstep(edge0: number, edge1: number, x: number) {
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return x * x * (3 - 2 * x);
}

type BlinkProps = {
  speed: number;
};

export function useOpenAIBlink({ speed }: BlinkProps) {
  const [eyeScale, setEyeScale] = useState(1);
  const [frame, setFrame] = useState(0);
  const frameId = useRef(-1);

  useEffect(() => {
    function nextFrame() {
      frameId.current = window.requestAnimationFrame(() => {
        setFrame(frame + 1);
        let s = easeOutQuint((Math.sin(frame * speed) + 1) * 2);
        s = smoothstep(0.1, 0.25, s);
        s = Math.min(1, s);
        setEyeScale(s);
        nextFrame();
      });
    }

    nextFrame();

    return () => {
      window.cancelAnimationFrame(frameId.current);
    };
  }, [speed, eyeScale, frame]);

  return eyeScale;
}

export default function useOpenAIFace(): OpenAIFaceResults {
  const [eyeScale, setEyeScale] = useState(1);
  const [mouthScale, setMouthScale] = useState(0);
  const [volume, setVolume] = useState(0);

  // Try to get OpenAI context, but handle if not available
  try {
    const context = useOpenAIRealtimeContext();
    if (context?.volume !== undefined) {
      setVolume(context.volume);
    }
  } catch (error) {
    // Context not available, use default values
    console.warn('OpenAI Realtime context not available, using default values');
  }

  const blinkEyeScale = useOpenAIBlink({ speed: 0.0125 });

  // Use blink animation for eyes
  useEffect(() => {
    setEyeScale(blinkEyeScale);
  }, [blinkEyeScale]);

  // Smoothly animate mouth movement based on OpenAI volume
  useEffect(() => {
    const targetScale = clamp(volume * 1.8, 0, 1); // Slightly more sensitive than Gemini
    // Ease towards target
    setMouthScale(current => current + (targetScale - current) * 0.4);
  }, [volume]);

  return { eyeScale, mouthScale };
}