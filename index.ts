import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'

const app = express()
const port = process.env.PORT || 3000

app.use(cors())

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://bitd-diceroller.vercel.app'],
    methods: ['GET', 'POST'],
  },
})

const users: { name: string; room: string }[] = []

app.get('/', (req, res) => {
  res.send('hello world')
})

io.on('connection', (socket) => {
  console.log('connected', socket.id)

  socket.on('userJoined', ({ room, username }) => {
    socket.join(room)
    users.push({ name: username, room })

    console.log(`user: ${username} joined room: ${room}`)

    const usersInRoom = users.filter((p) => p.room === room).map((p) => p.name)

    io.to(room).emit('usersUpdated', usersInRoom)
  })

  socket.on('roll', ({ rollType, position, hasDisadvantage, diceCount, room, username }) => {
    const dice: number[] = []

    let count = diceCount
    if (diceCount === 0) count = 2

    for (let i = 0; i < count; i++) {
      dice.push(Math.floor(Math.random() * 6 + 1))
    }
    console.log(`${username} rolled and got ${dice.join()}`)
    io.sockets.in(room).emit('rolled', { rollType, position, hasDisadvantage, dice, diceCount, username })
  })

  socket.on('disconnecting', (reason) => {
    let room
    socket.rooms.forEach((r) => {
      if (r !== socket.id) room = r
    })
    const index = users.findIndex((p) => p.room === room)
    if (index > -1) {
      users.splice(index, 1)
    }
    io.to(room).emit(
      'usersUpdated',
      users.map((p) => p.name)
    )
  })
})

app.get('/user', (req, res) => {
  const { username, room } = req.query
  if (users.find((p) => p.room === room && p.name === username)) {
    res.send({ exists: true })
  } else {
    res.send({ exists: false })
  }
})

server.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`)
})
