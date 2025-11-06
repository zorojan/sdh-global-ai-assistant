/**
 * Simple OpenAI Animated Face - Fallback version without complex dependencies
 */
import { RefObject, useEffect, useState } from 'react';

type SimpleOpenAIFaceProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  radius?: number;
  color?: string;
  avatarUrl?: string;
  isActive?: boolean;
  volume?: number;
};

export default function SimpleOpenAIFace({
  canvasRef,
  radius = 128,
  color = "#00a67e",
  avatarUrl,
  isActive = false,
  volume = 0,
}: SimpleOpenAIFaceProps) {
  const [avatarImage, setAvatarImage] = useState<HTMLImageElement | null>(null);
  const [eyeScale, setEyeScale] = useState(1);
  const [mouthScale, setMouthScale] = useState(0);

  // Load avatar image
  useEffect(() => {
    if (avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = avatarUrl;
      img.onload = () => setAvatarImage(img);
      img.onerror = () => setAvatarImage(null);
    } else {
      setAvatarImage(null);
    }
  }, [avatarUrl]);

  // Simple blinking animation
  useEffect(() => {
    if (!isActive) return;
    
    const blinkInterval = setInterval(() => {
      setEyeScale(0.1);
      setTimeout(() => setEyeScale(1), 150);
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(blinkInterval);
  }, [isActive]);

  // Volume-based mouth animation
  useEffect(() => {
    const targetMouth = Math.min(volume * 2, 1);
    setMouthScale(current => current + (targetMouth - current) * 0.3);
  }, [volume]);

  // Render face
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = radius * 2;
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    if (avatarImage) {
      // Draw circular avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 5, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImage, 5, 5, size - 10, size - 10);
      ctx.restore();

      // Add mouth overlay if speaking
      if (mouthScale > 0.1) {
        const mouthY = radius + radius * 0.3;
        const mouthWidth = radius * 0.3 * mouthScale;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.ellipse(radius, mouthY, mouthWidth, mouthWidth * 0.5, 0, 0, Math.PI);
        ctx.fill();
      }
    } else {
      // Draw basic face
      // Face circle
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? color : '#e0e0e0';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes
      const eyeY = radius - radius * 0.2;
      const eyeRadius = 6 * eyeScale;
      
      // Left eye
      ctx.beginPath();
      ctx.arc(radius - radius * 0.25, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#333';
      ctx.fill();

      // Right eye
      ctx.beginPath();
      ctx.arc(radius + radius * 0.25, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      if (mouthScale > 0.05) {
        const mouthY = radius + radius * 0.2;
        const mouthWidth = radius * 0.4 * mouthScale;
        
        ctx.beginPath();
        ctx.arc(radius, mouthY, mouthWidth, 0, Math.PI);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, [canvasRef, radius, color, isActive, avatarImage, eyeScale, mouthScale]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        borderRadius: '50%',
        boxShadow: isActive ? `0 0 20px ${color}40` : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    />
  );
}