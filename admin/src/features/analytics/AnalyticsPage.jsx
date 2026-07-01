import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { motion } from 'framer-motion'
import { Download, ChevronDown } from 'lucide-react'
import { mockAnalytics } from './mockData'
import { staggerContainer, staggerItem } from '../../shared/lib/motion'

const PIE_COLORS = ['#0F6E56', '#854F0B', '#5C6B68']

function MetricCard({ label, value }) {
  return (
    <motion.div className="bg-surface-card border border-border rounded-xl p-5" {...staggerItem}>
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className="text-3xl font-bold text-brand-600">{value}</div>
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const data = mockAnalytics

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-text-primary">Analytics</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm rounded-md border border-border-strong flex items-center gap-1 hover:bg-surface-muted transition-colors">
            Filters <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button className="px-3 py-2 text-sm rounded-md border border-border-strong flex items-center gap-1 hover:bg-surface-muted transition-colors">
            <Download size={14} aria-hidden="true" /> PDF
          </button>
          <button className="px-3 py-2 text-sm rounded-md border border-border-strong flex items-center gap-1 hover:bg-surface-muted transition-colors">
            <Download size={14} aria-hidden="true" /> CSV
          </button>
        </div>
      </div>

      <motion.div className="grid grid-cols-4 gap-4 mb-5" {...staggerContainer}>
        <MetricCard label="Items reported" value={data.itemsReported} />
        <MetricCard label="Claim approval rate" value={`${data.claimApprovalRate}%`} />
        <MetricCard label="Avg time to recovery" value={`${data.avgTimeToRecoveryDays} days`} />
        <MetricCard label="Avg trust score" value={data.avgTrustScore} />
      </motion.div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="bg-surface-card border border-border rounded-xl p-4">
          <div className="text-sm font-semibold mb-2">Reports over time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.reportsOverTime}>
              <CartesianGrid stroke="#E2E8E6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#06433C"
                strokeWidth={2}
                dot={false}
                name="Reports filed"
                isAnimationActive
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface-card border border-border rounded-xl p-4">
          <div className="text-sm font-semibold mb-2">Trust score distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.trustDistribution}
                dataKey="value"
                nameKey="band"
                innerRadius={40}
                outerRadius={65}
                isAnimationActive
                animationDuration={500}
              >
                {data.trustDistribution.map((entry, i) => (
                  <Cell key={entry.band} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface-card border border-border rounded-xl p-4 mt-4">
        <div className="text-sm font-semibold mb-2">Claim outcomes by category</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.claimsByCategory}>
            <CartesianGrid stroke="#E2E8E6" vertical={false} />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="approved" stackId="a" fill="#0F6E56" name="Approved" isAnimationActive animationDuration={500} />
            <Bar dataKey="rejected" stackId="a" fill="#5C6B68" name="Rejected" isAnimationActive animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
