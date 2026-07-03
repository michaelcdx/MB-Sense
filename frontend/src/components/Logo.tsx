import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export default function Logo({ className = 'h-4 w-4', ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 1000 600"
      className={className}
      fill="none"
      stroke="currentColor"
      {...props}
    >
      {/* Battery Body */}
      <rect
        x="100"
        y="100"
        width="700"
        height="400"
        rx="80"
        ry="80"
        fill="none"
        stroke="currentColor"
        strokeWidth="36"
      />
      
      {/* Right Terminal Loop */}
      <path
        d="M 800,210 A 90,90 0 0 1 800,390"
        fill="none"
        stroke="currentColor"
        strokeWidth="36"
        strokeLinecap="round"
      />
      
      {/* Left Probe Line and Circle */}
      <line
        x1="100"
        y1="300"
        x2="300"
        y2="300"
        stroke="currentColor"
        strokeWidth="36"
        strokeLinecap="butt"
      />
      <circle
        cx="330"
        cy="300"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="36"
      />
      
      {/* Lightning Bolt */}
      <polygon
        points="610,160 700,310 600,310 570,440 480,290 580,290"
        fill="currentColor"
      />
    </svg>
  );
}
