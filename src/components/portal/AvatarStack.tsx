"use client"

import { cn } from '@open-mercato/shared/lib/utils'

type AvatarStackProps = {
  /** Array of avatar objects (initials + optional imageUrl) */
  avatars: Array<{ name: string; imageUrl?: string }>
  /** Max avatars to show before +N */
  max?: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'size-6 text-[10px] -ml-1.5 ring-1',
  md: 'size-8 text-xs -ml-2 ring-2',
  lg: 'size-10 text-sm -ml-2.5 ring-2',
}

/**
 * Overlapping circular avatar stack with +N overflow count.
 */
export function AvatarStack({ avatars, max = 3, size = 'md', className }: AvatarStackProps) {
  const visible = avatars.slice(0, max)
  const overflow = avatars.length - max

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((avatar, i) => (
        <div
          key={i}
          className={cn(
            'relative flex items-center justify-center rounded-full bg-portal-primary/10 ring-white dark:ring-slate-800 font-medium text-portal-primary',
            sizeStyles[size],
            i === 0 && 'ml-0',
          )}
          title={avatar.name}
        >
          {avatar.imageUrl ? (
            <img src={avatar.imageUrl} alt={avatar.name} className="size-full rounded-full object-cover" />
          ) : (
            avatar.name.charAt(0).toUpperCase()
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 ring-white dark:ring-slate-800 font-medium text-gray-600 dark:text-gray-400',
            sizeStyles[size],
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
