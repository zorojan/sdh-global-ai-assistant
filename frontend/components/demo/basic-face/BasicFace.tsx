/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { RefObject, useEffect, useState } from 'react';

import { renderBasicFace } from './basic-face-render';
import useFace from '../../../hooks/demo/use-face';
import useTilt from '../../../hooks/demo/use-tilt';
import useHover from '../../../hooks/demo/use-hover';

type BasicFaceProps = {
  /** The canvas element on which to render the face. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The radius of the face. */
  radius?: number;
  /** The color of the face. */
  color?: string;
  /** The URL of the avatar image. */
  avatarUrl?: string;
  /** Preloaded avatar image element. */
  avatarImage?: HTMLImageElement | null;
  /** Whether the face should be in an "active" state (e.g., tilting). */
  isActive?: boolean;
};

export default function BasicFace({
  canvasRef,
  radius = 250,
  color,
  avatarUrl,
  isActive = false,
}: BasicFaceProps) {
  const { eyeScale, mouthScale } = useFace();
  const [scale, setScale] = useState(0.1);
  const [avatarImage, setAvatarImage] = useState<HTMLImageElement | null>(null);
  const tiltAngle = useTilt({ maxAngle: 3, speed: 0.05, isActive });
  const hoverOffset = useHover({ amplitude: 5, frequency: 0.2 });

  // Load avatar image
  useEffect(() => {
    if (avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous'; // Handle potential CORS issues
      img.src = avatarUrl;
      img.onload = () => setAvatarImage(img);
      img.onerror = () => {
        console.error('Failed to load avatar image:', avatarUrl);
        setAvatarImage(null);
      };
    } else {
      setAvatarImage(null);
    }
  }, [avatarUrl]);

  useEffect(() => {
    function calculateScale() {
      setScale(Math.min(window.innerWidth, window.innerHeight) / 1000);
    }
    window.addEventListener('resize', calculateScale);
    calculateScale();
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Render the face on the canvas
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')!;
    if (!ctx) return;
    renderBasicFace({
      ctx,
      mouthScale,
      eyeScale,
      color,
      avatarImage, // Pass image
    });
  }, [canvasRef, mouthScale, eyeScale, color, scale, avatarImage]);

  return (
    <div
      style={{
        transform: `translateY(${hoverOffset}px) rotate(${tiltAngle}deg)`,
        transition: 'transform 0.3s ease-out',
      }}
    >
      <canvas
        className="basic-face"
        ref={canvasRef}
        width={radius * 2 * scale}
        height={radius * 2 * scale}
        style={{
          display: 'block',
        }}
      />
    </div>
  );
}
