export default function ModelLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando métricas del modelo">
      <div className="space-y-2">
        <div className="h-7 w-72 rounded-lg bg-[var(--surface2)] animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-[var(--surface2)] animate-pulse" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-[var(--surface2)] animate-pulse" />
            <div className="h-8 w-16 rounded bg-[var(--surface2)] animate-pulse" />
          </div>
        ))}
      </div>

      <div className="card p-5 space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-5 rounded bg-[var(--surface2)] animate-pulse" style={{ width: `${90 - i * 6}%` }} />
        ))}
      </div>
    </div>
  )
}
