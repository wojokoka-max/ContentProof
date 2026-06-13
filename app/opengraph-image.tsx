import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ContentProof - analiza SEO i jakości treści';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          color: '#111111',
          padding: '72px 80px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              background: '#111111',
              color: '#ffffff',
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>ContentProof</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ maxWidth: 980, fontSize: 72, lineHeight: 1.05, fontWeight: 800 }}>
            Analiza SEO i jakości treści
          </div>
          <div style={{ fontSize: 30, color: '#555555' }}>
            Tekst, opublikowany URL i HTML
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#777777' }}>
          <span>Gotowe poprawki, meta dane i FAQ</span>
          <span>NextDoor Studio</span>
        </div>
      </div>
    ),
    size
  );
}
