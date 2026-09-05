import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, MapPin, CheckCircle, XCircle, Loader2, X, Shield } from 'lucide-react'
import { apiClient } from '@/api/client'

interface SelfCheckInProps {
  scheduleId: string
  scheduleTitle: string
  courseTitle: string
  onClose: () => void
}

interface CheckInResult {
  success: boolean
  status: string
  record_id: string
  was_created: boolean
  message: string
}

/** Compress a video frame to a tiny base64 JPEG thumbnail. */
function captureThumbnail(
  video: HTMLVideoElement,
  maxPx = 100,
  quality = 0.5,
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const w = video.videoWidth
    const h = video.videoHeight
    const scale = Math.min(maxPx / w, maxPx / h)
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    resolve(canvas.toDataURL('image/jpeg', quality))
  })
}

export function SelfCheckIn({ scheduleId, scheduleTitle, courseTitle, onClose }: SelfCheckInProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<'capture' | 'confirm' | 'submitting' | 'done' | 'error'>('capture')
  const [thumbnail, setThumbnail] = useState<string>('')
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'done' | 'denied' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)

  // Start camera
  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 320 },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        if (!cancelled) setErrorMsg('Camera access denied. Please allow camera permission and try again.')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Request geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLocationStatus('done')
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.srcObject) {
      setErrorMsg('Camera not ready.')
      setPhase('error')
      return
    }
    const thumb = await captureThumbnail(video)
    setThumbnail(thumb)
    setPhase('confirm')
  }, [])

  const handleSubmit = useCallback(async () => {
    setPhase('submitting')
    try {
      const res = await apiClient.post<CheckInResult>('/attendance/records/self-check-in/', {
        schedule_id: scheduleId,
        face_thumbnail: thumbnail || '',
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        location_accuracy_m: location?.accuracy ?? null,
      })
      setResult(res)
      setPhase('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed'
      setErrorMsg(msg)
      setPhase('error')
    }
  }, [scheduleId, thumbnail, location])

  // Cleanup camera on close
  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Self Check-In</h2>
          </div>
          <button onClick={handleClose} className="text-navy-400 hover:text-white p-1 rounded" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Schedule info */}
        <div className="px-4 py-3 bg-navy-800/50 border-b border-navy-700">
          <p className="text-xs text-navy-300">{courseTitle}</p>
          <p className="text-sm font-medium text-white">{scheduleTitle}</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Phase: Capture */}
          {phase === 'capture' && (
            <>
              {errorMsg && !videoRef.current?.srcObject ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <XCircle size={40} className="text-red-400" />
                  <p className="text-sm text-red-400 text-center">{errorMsg}</p>
                  <button onClick={handleClose} className="text-xs text-navy-400 hover:text-white">Close</button>
                </div>
              ) : (
                <>
                  {/* Camera feed */}
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-h-[280px] mx-auto">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded px-2 py-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] text-white">Live</span>
                    </div>
                  </div>

                  {/* Geolocation status */}
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin size={14} className={
                      locationStatus === 'done' ? 'text-green-400' :
                      locationStatus === 'denied' ? 'text-yellow-400' : 'text-navy-500'
                    } />
                    <span className="text-navy-300">
                      {locationStatus === 'loading' && 'Getting location...'}
                      {locationStatus === 'done' && `Location: ${location!.lat.toFixed(5)}, ${location!.lng.toFixed(5)} (±${location!.accuracy.toFixed(0)}m)`}
                      {locationStatus === 'denied' && 'Location access denied (optional)'}
                      {locationStatus === 'error' && 'Location unavailable'}
                      {locationStatus === 'idle' && 'Requesting location...'}
                    </span>
                  </div>

                  <button
                    onClick={handleCapture}
                    className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Camera size={18} />
                    Capture Selfie
                  </button>

                  <p className="text-[10px] text-navy-500 text-center">
                    <Shield size={10} className="inline mr-1" />
                    Your photo is stored as a tiny thumbnail (≤50 KB) for attendance verification only.
                  </p>
                </>
              )}
            </>
          )}

          {/* Phase: Confirm */}
          {phase === 'confirm' && (
            <>
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-cyan-500">
                  <img src={thumbnail} alt="Your selfie" className="w-full h-full object-cover scale-x-[-1]" />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle size={14} />
                  <span>Selfie captured</span>
                </div>
                <div className={`flex items-center gap-2 ${location ? 'text-green-400' : 'text-yellow-400'}`}>
                  {location ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>
                    {location
                      ? `Location: ±${location.accuracy.toFixed(0)}m accuracy`
                      : 'No location (optional)'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPhase('capture')}
                  className="flex-1 py-2.5 rounded-xl border border-navy-600 text-navy-300 hover:text-white hover:border-navy-500 text-sm transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle size={16} />
                  Check In
                </button>
              </div>
            </>
          )}

          {/* Phase: Submitting */}
          {phase === 'submitting' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={32} className="text-cyan-400 animate-spin" />
              <p className="text-sm text-navy-300">Submitting check-in...</p>
            </div>
          )}

          {/* Phase: Done */}
          {phase === 'done' && result && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={48} className="text-green-400" />
              <p className="text-lg font-semibold text-white capitalize">{result.status}</p>
              <p className="text-sm text-navy-300 text-center">{result.message}</p>
              {result.was_created && (
                <span className="badge text-xs bg-green-900/30 text-green-400 border border-green-700/50">New check-in</span>
              )}
              {!result.was_created && (
                <span className="badge text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-700/50">Updated</span>
              )}
              <button
                onClick={handleClose}
                className="mt-2 px-6 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-sm transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Phase: Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle size={40} className="text-red-400" />
              <p className="text-sm text-red-400 text-center">{errorMsg}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setErrorMsg(''); setPhase('capture') }}
                  className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-sm transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl border border-navy-600 text-navy-300 hover:text-white text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
