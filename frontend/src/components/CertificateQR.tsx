import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect } from 'react'

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

export function CertificateQR({ verificationCode, certificateNumber, size = 160 }: CertificateQRProps) {
  const verifyUrl = `${window.location.origin}/verify-certificate/${verificationCode}`
  const [logo, setLogo] = useState(getLogo)

  useEffect(() => {
    // Listen for logo changes from admin settings
    const handler = () => setLogo(getLogo())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const logoSize = Math.round(size * 0.22)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-lg relative">
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
      </div>
      {certificateNumber && (
        <p className="text-navy-400 text-xs font-mono">{certificateNumber}</p>
      )}
      <p className="text-navy-500 text-[10px]">Scan to verify authenticity</p>
    </div>
  )
}
