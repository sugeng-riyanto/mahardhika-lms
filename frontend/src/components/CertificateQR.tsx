import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect } from 'react'
import { X, ZoomIn } from 'lucide-react'

// Default Mahardhika logo as SVG data URL (blue circle with "A")
const DEFAULT_LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#0891b2"/><text x="50" y="62" font-family="Arial,sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">A</text></svg>'
)

function getLogo(): string {
  try {
    return localStorage.getItem('org_logo') || DEFAULT_LOGO
  } catch {
    return DEFAULT_LOGO
  }
}

interface CertificateQRProps {
  verificationCode: string
  certificateNumber?: string
  size?: number
}

function QRCodeInner({ verifyUrl, logo, size }: { verifyUrl: string; logo: string; size: number }) {
  const logoSize = Math.round(size * 0.22)
  return (
    <QRCodeSVG
      value={verifyUrl}
      size={size}
      level="H"
      includeMargin={false}
      imageSettings={{
        src: logo,
        x: undefined,
        y: undefined,
        height: logoSize,
        width: logoSize,
        excavate: true,
      }}
    />
  )
}

export function CertificateQR({ verificationCode, certificateNumber, size = 160 }: CertificateQRProps) {
  const verifyUrl = `${window.location.origin}/verify-certificate/${verificationCode}`
  const [logo, setLogo] = useState(getLogo)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    const handler = () => setLogo(getLogo())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!zoomed) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zoomed])

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => setZoomed(true)}
          className="bg-white p-3 rounded-lg relative cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all group"
          title="Click to zoom QR code"
        >
          <QRCodeInner verifyUrl={verifyUrl} logo={logo} size={size} />
          <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn size={24} className="text-white" />
          </div>
        </button>
        {certificateNumber && (
          <p className="text-navy-400 text-xs font-mono">{certificateNumber}</p>
        )}
        <p className="text-navy-500 text-[10px]">Click to zoom · Scan to verify</p>
      </div>

      {/* Zoom modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoomed(false)}
        >
          <div
            className="bg-navy-900 border border-navy-700 rounded-2xl p-8 shadow-2xl relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomed(false)}
              className="absolute top-3 right-3 text-navy-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-6 rounded-xl">
                <QRCodeInner verifyUrl={verifyUrl} logo={logo} size={320} />
              </div>
              {certificateNumber && (
                <p className="text-navy-300 text-sm font-mono">{certificateNumber}</p>
              )}
              <p className="text-navy-500 text-xs text-center">Scan this QR code to verify certificate authenticity</p>
              <a
                href={verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-sm underline"
              >
                Or click here to verify online
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
