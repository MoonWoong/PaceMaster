import React from 'react';

/**
 * StadiumTrackBackground
 * 실제 사진과 같은 리얼 트랙 운동장 사진 배경 (러닝 트랙 & 잔디 필드)
 */
export const StadiumTrackBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Real Stadium Running Track Photograph */}
      <img
        src="/track_stadium_photo.jpg"
        alt="Athletic Stadium Running Track"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.03]"
      />

      {/* 2. Soft Ambient Vignette & Warm Tint Overlay for Content Legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/25 via-white/10 to-stone-900/35 backdrop-blur-[0.5px]" />
      <div className="absolute inset-0 bg-radial-at-c from-transparent via-stone-900/10 to-stone-900/40" />
    </div>
  );
};
