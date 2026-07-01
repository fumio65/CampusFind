import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import bulkImportRouter from './routes/bulkImport.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.ADMIN_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (req, res) => res.json({ ok: true }))

app.use('/accounts', bulkImportRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Unexpected server error.' })
})

app.listen(PORT, () => {
  console.log(`CampusFind server listening on http://localhost:${PORT}`)
})