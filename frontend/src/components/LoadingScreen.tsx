export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-navy-300 text-sm">Loading AKADEMI...</p>
      </div>
    </div>
  )
}
