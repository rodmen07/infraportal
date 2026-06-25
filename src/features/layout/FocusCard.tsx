interface FocusCardProps {
  children: React.ReactNode
  className?: string
}

export function FocusCard({ children, className }: FocusCardProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center py-12 ${className ?? ''}`}>
      <div className="relative w-full">
        {children}
      </div>
    </div>
  )
}
