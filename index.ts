import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'

const app = express()
const port = process.env.PORT || 3000

app.use(cors())

const server = http.createServer(app)

const origin = ['https://bumpinthedark-diceroller.vercel.app']

if (process.env.NODE_ENV === 'development') {
  origin.push('http://localhost:3000')
}

const io = new Server(server, {
  cors: {
    origin,
    methods: ['GET', 'POST'],
  },
})

const users: { name: string; room: string; isKeeper: boolean; socketId: string }[] = []

app.get('/', (req, res) => {
  res.send('hello world')
})

io.on('connection', (socket) => {
  console.log('connected', socket.id)

  socket.on('userJoined', ({ room, username, isKeeper }) => {
    socket.join(room)
    users.push({ name: username, room, isKeeper, socketId: socket.id })

    console.log(`${isKeeper ? 'keeper' : 'hunter'}: ${username} joined room: ${room}`)

    const usersInRoom = users.filter((p) => p.room === room)
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

  socket.on('clocksUpdated', ({ clocks, room }) => {
    io.sockets.in(room).emit('clocksUpdated', clocks)
  })

  socket.on('disconnecting', (reason) => {
    let room
    socket.rooms.forEach((r) => {
      if (r !== socket.id) room = r
    })
    const index = users.findIndex((u) => u.socketId === socket.id)
    if (index > -1) {
      const [removedUser] = users.splice(index, 1)
      console.log(`Player: ${removedUser.name} with socketId: ${socket.id} left room: ${room}`)
    } else {
      console.log(
        `Tried to remove user with socketId: ${socket.id} from room: ${room}, but it didn't exist in the users array`
      )
    }

    const usersInRoom = users.filter((u) => u.room === room)
    io.to(room).emit('usersUpdated', usersInRoom)
  })
})

app.get('/user', (req, res) => {
  const { username, room } = req.query
  res.send({ doesUserExist: !!users.find((u) => u.room === room && u.name === username) })
})

app.get('/room', (req, res) => {
  const { room } = req.query
  res.send({ doesRoomExist: !!users.find((u) => u.room === room) })
})

server.listen(port, () => {
  console.log(`Server running on port ${port}!`)
})
