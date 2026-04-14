import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Receipt,
  Calculator,
  Shield,
  BarChart3,
  Home,
  Clock,
  Settings,
  Sparkles,
  Calendar,
  Target,
  Download,
  FolderArchive,
  Users,
  Landmark,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** When true, render as a disabled placeholder. Never navigates. */
  comingSoon?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: 'Home',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/gst', label: 'GST / BAS', icon: Receipt },
      { href: '/tax', label: 'Tax Position', icon: Calculator },
      { href: '/deductions', label: 'Deductions', icon: Shield },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Household',
    items: [
      { href: '/household', label: 'Household Tax', icon: Home },
      { href: '#household-members', label: 'Family Overview', icon: Users, comingSoon: true },
      { href: '#household-bank', label: 'Bank Accounts', icon: Landmark, comingSoon: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/documents', label: 'Documents', icon: FolderArchive },
      { href: '/claims', label: 'Claims', icon: Target },
      { href: '/time-machine', label: 'Time Machine', icon: Clock },
      { href: '#rod-chat', label: 'Ask Rod', icon: Sparkles, comingSoon: true },
      { href: '#compliance-calendar', label: 'Compliance Calendar', icon: Calendar, comingSoon: true },
      { href: '#backup', label: 'Backup', icon: Download, comingSoon: true },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

/** Flattened list of real (non-placeholder) nav items. */
export const liveNavItems: NavItem[] = navSections.flatMap((s) =>
  s.items.filter((i) => !i.comingSoon),
)
