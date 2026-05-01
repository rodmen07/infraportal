/**
 * Base Skeleton primitive component
 * Configurable width, height, and rounded corners
 * Includes shimmer animation via Tailwind utility
 */
interface SkeletonProps {
  width?: string | number
  height?: string | number
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Skeleton({ width, height = '1rem', rounded = 'md', className = '' }: SkeletonProps) {
  const roundedClass: Record<string, string> = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
  }

  const widthStyle = width ? (typeof width === 'number' ? `${width}px` : width) : undefined
  const heightStyle = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`bg-shimmer ${roundedClass[rounded]} ${className}`}
      style={{
        width: widthStyle,
        height: heightStyle,
      }}
    />
  )
}

/**
 * SkeletonText - Render multiple lines of skeleton text
 * Useful for text blocks, descriptions, paragraphs
 */
interface SkeletonTextProps {
  lines?: number
  className?: string
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(lines)].map((_, i) => {
        // Vary width for natural text appearance
        const widths = ['w-full', 'w-full', 'w-5/6', 'w-4/5', 'w-3/4']
        const width = widths[i % widths.length] || 'w-full'
        return (
          <Skeleton
            key={i}
            height="0.875rem"
            className={`${width}`}
            rounded="sm"
          />
        )
      })}
    </div>
  )
}

/**
 * SkeletonCard - Skeleton matching dashboard/list card shape
 * Used for project cards, data cards, or list items
 */
interface SkeletonCardProps {
  className?: string
  showImage?: boolean
}

export function SkeletonCard({ className = '', showImage = false }: SkeletonCardProps) {
  return (
    <div className={`forge-panel surface-card-strong p-4 space-y-4 ${className}`}>
      {showImage && (
        <Skeleton
          height="10rem"
          rounded="lg"
          className="w-full"
        />
      )}
      <div className="space-y-2">
        <Skeleton
          height="1.25rem"
          width="60%"
          rounded="sm"
        />
        <Skeleton
          height="0.875rem"
          width="80%"
          rounded="sm"
        />
      </div>
      <div className="flex gap-2">
        <Skeleton
          height="1.75rem"
          width="4rem"
          rounded="full"
        />
        <Skeleton
          height="1.75rem"
          width="5rem"
          rounded="full"
        />
      </div>
    </div>
  )
}

/**
 * SkeletonTable - Skeleton for tabular data
 * Shows rows and columns as placeholders
 */
interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
}

export function SkeletonTable({ rows = 4, cols = 4, className = '' }: SkeletonTableProps) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-zinc-700/40 ${className}`}>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/40 bg-zinc-800/40">
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton
                  height="0.875rem"
                  width={['w-16', 'w-24', 'w-20', 'w-12'][i % 4]}
                  rounded="sm"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-zinc-700/20">
              {[...Array(cols)].map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <Skeleton
                    height="1rem"
                    width={['w-20', 'w-32', 'w-24', 'w-16'][colIdx % 4]}
                    rounded="sm"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * SkeletonCircle - Circular skeleton, useful for avatars
 */
interface SkeletonCircleProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SkeletonCircle({ size = 'md', className = '' }: SkeletonCircleProps) {
  const sizeClass: Record<string, string> = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  return (
    <div
      className={`bg-shimmer rounded-full ${sizeClass[size]} ${className}`}
    />
  )
}

/**
 * SkeletonButton - Skeleton matching button shapes
 */
interface SkeletonButtonProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SkeletonButton({ size = 'md', className = '' }: SkeletonButtonProps) {
  const sizeClass: Record<string, { height: string; width: string }> = {
    sm: { height: '1.5rem', width: '5rem' },
    md: { height: '2rem', width: '6rem' },
    lg: { height: '2.5rem', width: '8rem' },
  }

  const { height, width } = sizeClass[size]

  return (
    <Skeleton
      height={height}
      width={width}
      rounded="lg"
      className={className}
    />
  )
}

/**
 * SkeletonAvatar - Skeleton for user avatars with optional label
 */
interface SkeletonAvatarProps {
  showLabel?: boolean
  className?: string
}

export function SkeletonAvatar({ showLabel = false, className = '' }: SkeletonAvatarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SkeletonCircle size="md" />
      {showLabel && (
        <div className="space-y-1">
          <Skeleton
            height="0.875rem"
            width="8rem"
            rounded="sm"
          />
          <Skeleton
            height="0.75rem"
            width="6rem"
            rounded="sm"
          />
        </div>
      )}
    </div>
  )
}

/**
 * SkeletonBadge - Skeleton for badges/pills
 */
interface SkeletonBadgeProps {
  className?: string
}

export function SkeletonBadge({ className = '' }: SkeletonBadgeProps) {
  return (
    <Skeleton
      height="1.5rem"
      width="5rem"
      rounded="full"
      className={className}
    />
  )
}

/**
 * SkeletonListItem - Skeleton for list items with optional icon
 */
interface SkeletonListItemProps {
  showIcon?: boolean
  className?: string
}

export function SkeletonListItem({ showIcon = false, className = '' }: SkeletonListItemProps) {
  return (
    <div className={`flex items-center gap-3 py-2 ${className}`}>
      {showIcon && <SkeletonCircle size="sm" />}
      <div className="min-w-0 flex-1 space-y-1">
        <Skeleton
          height="0.875rem"
          width="70%"
          rounded="sm"
        />
        <Skeleton
          height="0.75rem"
          width="50%"
          rounded="sm"
        />
      </div>
    </div>
  )
}
