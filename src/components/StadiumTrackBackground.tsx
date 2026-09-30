import React from 'react';

/**
 * StadiumTrackBackground
 * 따사로운 봄 햇살 아래 푸른 잔디밭과 붉은 우레탄/클레이 육상 트랙이 펼쳐진
 * 화사하고 싱그러운 야외 운동장 배경 (2027 경주 벚꽃 & 국제 마라톤 테마)
 */
export const StadiumTrackBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Base Spring Atmosphere: Clear bright spring morning sky & fresh warmth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#e8f5e9] via-[#f1f8f3] to-[#fbf7f4]" />

      {/* 2. Responsive Vector Outdoor Stadium with Grass Field & 8-Lane Tartan Track */}
      <svg
        className="absolute inset-0 w-full h-full object-cover opacity-95 transition-opacity duration-700"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gentle Spring Sunlight Warmth (Top-Right) */}
          <radialGradient id="springMorningSun" cx="80%" cy="12%" r="65%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.75" />
            <stop offset="35%" stopColor="#dcfce7" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#e0f2fe" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f4fbf5" stopOpacity="0" />
          </radialGradient>

          {/* Running Track - Gyeongju Marathon Heritage Burgundy & Terracotta Clay */}
          <linearGradient id="brightTrackClay" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a32128" />
            <stop offset="25%" stopColor="#881337" />
            <stop offset="50%" stopColor="#991b1b" />
            <stop offset="75%" stopColor="#b43422" />
            <stop offset="100%" stopColor="#7e141a" />
          </linearGradient>

          {/* Fresh Spring Lawn Grass Infield with Alternating Mowed Stripes */}
          <linearGradient id="freshSpringGrass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="12.5%" stopColor="#34d399" />
            <stop offset="25%" stopColor="#16a34a" />
            <stop offset="37.5%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#15803d" />
            <stop offset="62.5%" stopColor="#22c55e" />
            <stop offset="75%" stopColor="#16a34a" />
            <stop offset="87.5%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          {/* Soft Spring Breeze with Cherry Blossom Tones */}
          <linearGradient id="blossomSkyBreeze" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe4e6" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fef2f2" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Distant Spring Landscape: Gentle rolling green hills & blooming cherry blossom groves */}
        <g id="distantHills" opacity="0.6">
          {/* Far hills */}
          <path
            d="M 0 320 Q 480 240, 960 270 T 1920 250 L 1920 600 L 0 600 Z"
            fill="#bbf7d0"
            opacity="0.45"
          />
          {/* Nearer hills */}
          <path
            d="M 0 360 Q 560 290, 1100 330 T 1920 310 L 1920 650 L 0 650 Z"
            fill="#86efac"
            opacity="0.5"
          />
          {/* Subtle Cherry Blossom Grove Silhouettes (경주 보문호수 벚꽃) */}
          {[120, 240, 360, 1560, 1680, 1800].map((x, idx) => (
            <ellipse
              key={`tree-${idx}`}
              cx={x}
              cy={300 + (idx % 3) * 15}
              rx={36 + (idx % 2) * 8}
              ry={22 + (idx % 2) * 5}
              fill="#fbcfe8"
              opacity="0.65"
            />
          ))}
        </g>

        {/* Stadium Running Track (8 Lanes - Terracotta / Burgundy Clay) */}
        <g id="brightTrack">
          {/* Outer Track Base Oval */}
          <path
            d="M 960 110
               C 1520 110, 1860 280, 1860 540
               C 1860 800, 1520 970, 960 970
               C 400 970, 60 800, 60 540
               C 60 280, 400 110, 960 110 Z"
            fill="url(#brightTrackClay)"
            opacity="0.95"
          />

          {/* White Lane Markings (Lanes 1 to 8) with clean athletic curves */}
          {[
            { rx: 690, ry: 380, width: 3.5, dash: 'none', op: 0.9 },
            { rx: 715, ry: 400, width: 2, dash: '24, 16', op: 0.75 },
            { rx: 740, ry: 420, width: 2.2, dash: 'none', op: 0.8 },
            { rx: 765, ry: 440, width: 2, dash: '24, 16', op: 0.75 },
            { rx: 790, ry: 460, width: 2.4, dash: 'none', op: 0.85 },
            { rx: 815, ry: 480, width: 2, dash: '24, 16', op: 0.75 },
            { rx: 840, ry: 500, width: 2.2, dash: 'none', op: 0.8 },
            { rx: 870, ry: 525, width: 4, dash: 'none', op: 0.95 },
          ].map((lane, i) => (
            <ellipse
              key={`track-line-${i}`}
              cx="960"
              cy="540"
              rx={lane.rx}
              ry={lane.ry}
              fill="none"
              stroke="#ffffff"
              strokeWidth={lane.width}
              strokeOpacity={lane.op}
              strokeDasharray={lane.dash}
            />
          ))}

          {/* Finish Line on Home Straight */}
          <line
            x1="960"
            y1="890"
            x2="960"
            y2="970"
            stroke="#ffffff"
            strokeWidth="8"
            strokeOpacity="0.95"
          />
          <line
            x1="954"
            y1="890"
            x2="954"
            y2="970"
            stroke="#1c1917"
            strokeWidth="3.5"
            strokeOpacity="0.4"
            strokeDasharray="8, 8"
          />

          {/* Track Lane Numbers (1 to 8) */}
          {[
            { num: '1', y: 902 },
            { num: '2', y: 912 },
            { num: '3', y: 922 },
            { num: '4', y: 932 },
            { num: '5', y: 942 },
            { num: '6', y: 952 },
            { num: '7', y: 962 },
          ].map((item, i) => (
            <text
              key={`lane-no-${i}`}
              x="925"
              y={item.y}
              fill="#ffffff"
              fillOpacity="0.85"
              fontSize="10"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="bold"
              textAnchor="middle"
            >
              {item.num}
            </text>
          ))}
        </g>

        {/* Lush Green Spring Grass Field (Infield) */}
        <g id="springGrassField">
          {/* Inner Oval Turf Base */}
          <path
            d="M 960 170
               C 1420 170, 1680 320, 1680 540
               C 1680 760, 1420 910, 960 910
               C 500 910, 240 760, 240 540
               C 240 320, 500 170, 960 170 Z"
            fill="url(#freshSpringGrass)"
            opacity="0.96"
          />

          {/* Mowed Lawn Stripes (Vibrant Green Contrast) */}
          {[-280, -210, -140, -70, 0, 70, 140, 210, 280].map((offsetY, i) => (
            <path
              key={`grass-stripe-${i}`}
              d={`M ${960 - 580} ${540 + offsetY} L ${960 + 580} ${540 + offsetY}`}
              stroke="#4ade80"
              strokeWidth="34"
              strokeOpacity="0.22"
              strokeLinecap="round"
            />
          ))}

          {/* Athletic Field Markings (Center circle, penalty boxes) */}
          <circle
            cx="960"
            cy="540"
            r="115"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeOpacity="0.5"
          />
          <circle cx="960" cy="540" r="5" fill="#ffffff" opacity="0.75" />
          <line
            x1="960"
            y1="190"
            x2="960"
            y2="890"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.45"
          />
          <rect
            x="360"
            y="405"
            width="145"
            height="270"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.4"
            rx="4"
          />
          <rect
            x="1415"
            y="405"
            width="145"
            height="270"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.4"
            rx="4"
          />
        </g>

        {/* Spring Blossom Petals drifting gently in the morning breeze */}
        <g id="springPetals" opacity="0.65">
          <ellipse cx="260" cy="180" rx="9" ry="5.5" fill="#fbcfe8" transform="rotate(-25 260 180)" />
          <ellipse cx="310" cy="220" rx="8" ry="4.5" fill="#fda4af" transform="rotate(15 310 220)" />
          <ellipse cx="240" cy="270" rx="7.5" ry="4" fill="#fb7185" transform="rotate(40 240 270)" />

          <ellipse cx="1680" cy="170" rx="8.5" ry="5" fill="#fbcfe8" transform="rotate(30 1680 170)" />
          <ellipse cx="1740" cy="220" rx="9" ry="5.5" fill="#fda4af" transform="rotate(-15 1740 220)" />
          <ellipse cx="1650" cy="280" rx="8" ry="4.5" fill="#fb7185" transform="rotate(-45 1650 280)" />

          <ellipse cx="180" cy="790" rx="9" ry="5.5" fill="#fda4af" transform="rotate(20 180 790)" />
          <ellipse cx="230" cy="850" rx="8" ry="4.5" fill="#fbcfe8" transform="rotate(-35 230 850)" />
          <ellipse cx="1760" cy="800" rx="8.5" ry="5" fill="#fbcfe8" transform="rotate(-15 1760 800)" />
          <ellipse cx="1710" cy="860" rx="9" ry="5.5" fill="#fda4af" transform="rotate(25 1710 860)" />
        </g>

        {/* Gentle Sun Atmosphere Overlay */}
        <rect width="1920" height="1080" fill="url(#springMorningSun)" />
        <rect width="1920" height="1080" fill="url(#blossomSkyBreeze)" />
      </svg>

      {/* 3. Soft Spring Morning Vignette: Ensures exceptional readability without darkening the daylight */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8faf7]/40 via-transparent to-[#f4f7f2]/60" />
    </div>
  );
};
