import {
  LayoutDashboard,
  Trophy,
  CalendarClock,
  Megaphone,
  Users,
  QrCode,
  Presentation,
  ClipboardCheck,
  Search,
  FolderCode,
  ShieldAlert,
  Award,
  Heart,
  GitBranch,
  Bell,
  Settings,
  ChevronRight,
  Plus,
  Circle,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'trophy': Trophy,
  'calendar-clock': CalendarClock,
  'megaphone': Megaphone,
  'users': Users,
  'qr-code': QrCode,
  'presentation': Presentation,
  'clipboard-check': ClipboardCheck,
  'search': Search,
  'folder-code': FolderCode,
  'shield-alert': ShieldAlert,
  'award': Award,
  'heart': Heart,
  'git-branch': GitBranch,
  'bell': Bell,
  'settings': Settings,
  'chevron-right': ChevronRight,
  'plus': Plus,
}

/**
 * Resolve a `lucide:icon-name` string to a Lucide React icon component.
 */
export function resolveIcon(iconStr: string | undefined): LucideIcon {
  if (!iconStr) return Circle
  const name = iconStr.replace('lucide:', '')
  return iconMap[name] ?? Circle
}
