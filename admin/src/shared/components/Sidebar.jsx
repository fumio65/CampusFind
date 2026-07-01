import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  PersonStanding,
  BarChart3,
  Users,
} from 'lucide-react'
import sealSrc from '../../assets/nwssu-seal.png'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/bulk-import', label: 'Bulk import', icon: Upload },
  { to: '/reports', label: 'Reports', icon: ListChecks },
  { to: '/walk-in', label: 'Walk-in intake', icon: PersonStanding },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: Users },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-[210px] shrink-0 bg-brand-600 text-white flex flex-col py-5">
      <div className="flex items-center gap-2.5 px-5 pb-5 mb-2 border-b border-white/15">
        <img src={sealSrc} alt="" className="w-7 h-7 rounded-full object-cover" />
        <span className="text-sm font-bold">CampusFind admin</span>
      </div>
      <nav className="flex flex-col">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={`relative flex items-center gap-2.5 px-5 py-2.5 text-sm ${!isActive ? 'hover:text-white' : ''}`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-white/10 border-r-2 border-white"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon
                size={17}
                aria-hidden="true"
                className={`relative ${isActive ? 'text-white' : 'text-brand-100'}`}
              />
              <span className={`relative ${isActive ? 'text-white font-semibold' : 'text-brand-100'}`}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
