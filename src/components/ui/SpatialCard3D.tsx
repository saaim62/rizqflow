'use client';

import React, { useState, useRef, useCallback } from 'react';

interface SpatialCard3DProps {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
  spotlightColor?: string;
  onClick?: () => void;
}

export function SpatialCard3D({
  children,
  className = '',
  maxTiltDeg = 6,
  spotlightColor = 'rgba(255, 255, 255, 0.08)',
  onClick,
}: SpatialCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>('perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTiltDeg;
    const rotateY = ((x - centerX) / centerX) * maxTiltDeg;

    setTransformStyle(
      `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`
    );

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    setSpotlightPos({ x: xPercent, y: yPercent, opacity: 1 });
  }, [maxTiltDeg]);

  const handleMouseLeave = useCallback(() => {
    setTransformStyle('perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setSpotlightPos((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: transformStyle,
        transition: 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
      className={`relative rounded-2xl bg-[#FFFFFF] border border-white/[0.08] shadow-xl overflow-hidden will-change-transform ${className}`}
    >
      {/* Dynamic Specular Spotlight Layer */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: spotlightPos.opacity,
          background: `radial-gradient(600px circle at ${spotlightPos.x}% ${spotlightPos.y}%, ${spotlightColor}, transparent 40%)`,
        }}
      />

      {/* Top Specular Rim */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Card Content with subtle 3D lift */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
