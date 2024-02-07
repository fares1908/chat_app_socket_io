const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const httpStatusText = require('./utils/httpStatusText');

const url = process.env.MONGO_URL;
const { default: mongoose } = require('mongoose');

mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
    console.log('MongoDB connected successfully');
}).catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
});

const usersRouter = require('./routes/users.route');
app.use('/api/users', usersRouter);

app.all('*', (req, res, next) => {
    return res.status(404).json({ status: httpStatusText.ERROR, message: 'This resource is not available' });
});

app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: error.statusText || httpStatusText.ERROR,
        message: error.message,
        code: error.statusCode || 500,
        data: null
    });
});

const clients = {};

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "http://localhost:3000"
    }
});

io.on('connection', (socket) => {
    console.log(`${socket.id} connected`);

    socket.on('connection', (msg) => {
        console.log(msg);
    });

    socket.on("signIn", (data) => {
        if (data && data.id) {
            const { id, targetId } = data;
            console.log(`${id} signed in`);
            clients[id] = socket.id; // Add sender to clients
            if (targetId) {
                clients[targetId] = socket.id; // Add target to clients if targetId is provided
            }
            console.log("Updated clients:", clients);
        } else {
            console.log("Invalid data received during signIn:", data);
        }
    });

    // Change 'chat message' to 'sendMessage'
    socket.on('sendMessage', (msg) => {
        console.log(msg);
        let targetId = msg.targetId.toString();
        console.log(`targetId type: ${typeof targetId}, value: ${targetId}`);
        console.log(`clients keys: ${Object.keys(clients)}`);

        if (clients[targetId]) {
            // Change 'message-receive' to 'message-receive'
            io.to(clients[targetId]).emit('message-receive', msg);
        } else {
            console.log(`User with ID ${targetId} not found.`);
            socket.emit('errorMessage', { error: `User with ID ${targetId} not found.` });
        }
    });


    socket.once('chat message', (msg) => {
        console.log('message:', msg);
        io.emit('send message to all users', msg);
        io.to(socket.id).emit('res', `Hello ${msg.name}, welcome!`);
    });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});