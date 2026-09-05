import { QRCodeSVG } from 'qrcode.react'

interface CertificateQRProps {
  verificationCode: string
  certificateNumber?: string
  size?: number
}

export function CertificateQR({ verificationCode, certificateNumber, size = 160 }: CertificateQRProps) {
  const verifyUrl = `${window.location.origin}/verify-certificate/${verificationCode}`

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-lg">
        <QRCodeSVG
          value={verifyUrl}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      {certificateNumber && (
        <p className="text-navy-400 text-xs font-mono">{certificateNumber}</p>
      )}
      <p className="text-navy-500 text-[10px]">Scan to verify authenticity</p>
    </div>
  )
}
