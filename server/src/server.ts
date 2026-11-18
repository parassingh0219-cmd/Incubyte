import { app, prisma } from './app.js'

const port = Number(process.env.PORT) || 4000
const server = app.listen(port, () => console.log(`Company API listening on http://localhost:${port}`))

async function shutdown() {
  await prisma.$disconnect()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
