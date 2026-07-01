import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './shared/components/AppShell'
import OverviewPage from './features/overview/OverviewPage'
import BulkImportPage from './features/bulk-import/BulkImportPage'
import ReportsPage from './features/reports/ReportsPage'
import WalkInIntakePage from './features/walk-in/WalkInIntakePage'
import AnalyticsPage from './features/analytics/AnalyticsPage'
import AccountsPage from './features/accounts/AccountsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="bulk-import" element={<BulkImportPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="walk-in" element={<WalkInIntakePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
