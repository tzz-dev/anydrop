import { ImageResponse } from 'next/og';

export async function GET() {
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 22V10M11 10l-3 3.5M11 10l3 3.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21 10V22M21 22l-3-3.5M21 22l3-3.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#09090b',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
          width={135}
          height={135}
          alt=""
        />
      </div>
    ),
    { width: 180, height: 180 },
  );
}
