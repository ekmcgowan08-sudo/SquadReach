'use client';
/* A QR code drawn as inline SVG, in the app's own ink. */
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ url, size = 180, label }: { url: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 0, width: size, errorCorrectionLevel: 'M', color: { dark: '#f3f5feff', light: '#161826ff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [url, size]);
  return <div role="img" aria-label={label} className="rounded-md bg-[#161826] p-3" style={{ width: size + 24, height: size + 24 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
