/**
 * OpenAI Animated Face Component - Same style as Gemini BasicFace but for OpenAI
 */
import { RefObject, useEffect, useState } from 'react';

import { renderBasicFace } from '../basic-face/basic-face-render';
import useOpenAIFace from '../../../hooks/demo/use-openai-face';
import useTilt from '../../../hooks/demo/use-tilt';
import useHover from '../../../hooks/demo/use-hover';

type OpenAIAnimatedFaceProps = {
  /** The canvas element on which to render the face. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The radius of the face. */
  radius?: number;
  /** The color of the face. */
  color?: string;
  /** The URL of the avatar image. */
  avatarUrl?: string;
  /** Whether the face should be in an "active" state (e.g., tilting). */
  isActive?: boolean;
};

export default function OpenAIAnimatedFace({
  canvasRef,
  radius = 250,
  color = "#00a67e", // OpenAI green
  avatarUrl,
  isActive = false,
}: OpenAIAnimatedFaceProps) {
  // Use error boundary for face animation
  const [faceData, setFaceData] = useState({ eyeScale: 1, mouthScale: 0 });
  const [scale, setScale] = useState(0.1);
  const [avatarImage, setAvatarImage] = useState<HTMLImageElement | null>(null);
  const [tiltAngle, setTiltAngle] = useState(0);
  const [hoverOffset, setHoverOffset] = useState(0);

  // Safely get face animation data
  try {
    const { eyeScale, mouthScale } = useOpenAIFace();
    setFaceData({ eyeScale, mouthScale });
  } catch (error) {
    console.warn('OpenAI face animation not available:', error);
  }

  // Safely get tilt and hover animations
  try {
    const tilt = useTilt({ maxAngle: 3, speed: 0.05, isActive });
    const hover = useHover({ amplitude: 5, frequency: 0.2 });
    setTiltAngle(tilt);
    setHoverOffset(hover);
  } catch (error) {
    console.warn('Face animation effects not available:', error);
  }

  // Load avatar image
  useEffect(() => {
    if (avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
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

  // Render the face on the canvas using the same render function as Gemini
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')!;
    if (!ctx) return;
    
    // Render avatar image if available, otherwise use basic face
    if (avatarImage) {
      // Clear canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Draw circular avatar
      const centerX = ctx.canvas.width / 2;
      const centerY = ctx.canvas.height / 2;
      const faceRadius = Math.min(centerX, centerY) - 10;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, faceRadius, 0, Math.PI * 2);
      ctx.clip();
      
      // Draw avatar image
      ctx.drawImage(
        avatarImage, 
        centerX - faceRadius, 
        centerY - faceRadius, 
        faceRadius * 2, 
        faceRadius * 2
      );
      
      ctx.restore();
      
      // Add animated mouth overlay for avatar
      if (faceData.mouthScale > 0.1) {
        const mouthY = centerY + faceRadius * 0.3;
        const mouthWidth = faceRadius * 0.4 * faceData.mouthScale;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.ellipse(centerX, mouthY, mouthWidth, mouthWidth * 0.5, 0, 0, Math.PI);
        ctx.fill();
      }
    } else {
      // Use basic face renderer
      renderBasicFace({
        ctx,
        mouthScale: faceData.mouthScale,
        eyeScale: faceData.eyeScale,
        color,
      });
    }
  }, [canvasRef, faceData.mouthScale, faceData.eyeScale, color, scale, avatarImage]);

  return (
    <div
      style={{
        transform: `translateY(${hoverOffset}px) rotate(${tiltAngle}deg)`,
        transition: 'transform 0.3s ease-out',
      }}
    >
      <canvas
        className="basic-face openai-face" // Add OpenAI-specific class
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