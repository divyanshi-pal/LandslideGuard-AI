// Illustrated hill landscape for the home page hero (no external image, no licensing issues).
// Layers: dusk sky, distant ranges, forested ridge with a landslide scar, terraced foreground.
export default function HeroArt({ className = '' }) {
  return (
    <svg viewBox="0 0 1440 640" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Illustration of forested hills with a landslide scar on one slope">
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1730" />
          <stop offset="0.5" stopColor="#1d3b5f" />
          <stop offset="1" stopColor="#7d9db8" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.76" cy="0.52" r="0.35">
          <stop offset="0" stopColor="#fde7b0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde7b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d7290" />
          <stop offset="1" stopColor="#2f4f6b" />
        </linearGradient>
        <linearGradient id="hero-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f8a4f" />
          <stop offset="1" stopColor="#174c2b" />
        </linearGradient>
        <linearGradient id="hero-scar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b58d5f" />
          <stop offset="1" stopColor="#7a5a3a" />
        </linearGradient>
        <linearGradient id="hero-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1440" height="640" fill="url(#hero-sky)" />
      <rect width="1440" height="640" fill="url(#hero-glow)" />

      {/* distant ranges */}
      <path d="M0 360 L110 300 L210 335 L330 240 L440 318 L560 262 L690 330 L820 220 L950 300 L1070 235 L1190 312 L1310 250 L1440 318 V640 H0 Z" fill="url(#hero-far)" opacity="0.85" />
      <rect y="380" width="1440" height="90" fill="url(#hero-mist)" />

      {/* forested ridge */}
      <path d="M0 450 L140 392 L262 428 L380 348 L520 438 L640 376 L782 458 L900 356 L1010 418 L1122 322 L1252 418 L1362 378 L1440 404 V640 H0 Z" fill="url(#hero-mid)" />
      <path d="M1122 322 L1252 418 L1180 418 Z" fill="#123b22" opacity="0.35" />
      <path d="M380 348 L520 438 L450 438 Z" fill="#123b22" opacity="0.3" />

      {/* landslide scar and debris fan */}
      <path d="M1116 336 C1104 372 1098 414 1082 470 L1124 472 C1132 430 1131 392 1126 340 Z" fill="url(#hero-scar)" />
      <path d="M1046 478 C1070 466 1132 464 1158 480 C1132 490 1074 492 1046 478 Z" fill="#8a6a45" opacity="0.85" />
      <path d="M1104 380 l6 10 M1112 410 l-5 9 M1100 440 l7 8" stroke="#5e442b" strokeWidth="2" strokeLinecap="round" />

      {/* foreground terraced hills */}
      <path d="M0 540 C200 470 380 500 560 522 C760 546 900 470 1100 500 C1250 522 1350 482 1440 496 V640 H0 Z" fill="#123b22" />
      <g fill="none" stroke="#2f8a4f" strokeOpacity="0.45" strokeWidth="2">
        <path d="M0 566 C190 506 380 528 560 548 C760 570 900 500 1100 528 C1250 548 1350 512 1440 522" />
        <path d="M0 592 C190 540 380 556 560 574 C760 594 900 530 1100 556 C1250 574 1350 544 1440 552" />
        <path d="M0 618 C190 574 380 584 560 600 C760 618 900 562 1100 584 C1250 600 1350 576 1440 582" />
      </g>

      {/* winding hill road */}
      <path d="M940 640 C980 606 1052 600 1032 570 C1012 540 1098 528 1180 512 C1250 498 1300 506 1350 494" fill="none" stroke="#e9e1cf" strokeOpacity="0.75" strokeWidth="5" strokeLinecap="round" />

      {/* tree clusters */}
      <g fill="#0b2a17">
        {[[90, 520], [120, 512], [150, 520], [640, 528], [668, 520], [700, 532], [1290, 498], [1316, 492], [1342, 500]].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y} l12 -34 l12 34 z`} />
        ))}
      </g>
    </svg>
  )
}
