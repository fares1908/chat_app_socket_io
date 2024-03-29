const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// MongoDB connection
const url = process.env.MONGO_URL;
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch((error) => console.error('Error connecting to MongoDB:', error.message));

// Routes
const usersRouter = require('./routes/users.route');
app.use('/api/users', usersRouter);

// 404 Error Handling
app.all('*', (req, res, next) => {
    res.status(404).json({ status: 'ERROR', message: 'This resource is not available' });
});

// Global Error Handling Middleware
app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: error.statusText || 'ERROR',
        message: error.message,
        code: error.statusCode || 500,
        data: null
    });
});

// Socket.IO configuration
const clients = {};
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "https://chatapp-socket-ioo.onrender.com"
    }
});

// Socket.IO event handling
io.on('connection', (socket) => {
    console.log(`${socket.id} connected`);

    socket.on('signIn', (data) => handleSignIn(socket, data));
    socket.on('sendMessage', (msg) => handleSendMessage(socket, msg));

    socket.once('chat message', (msg) => {
        console.log('message:', msg);
        io.emit('send message to all users', msg);
        // io.to(socket.id).emit('res', `Hello ${msg.name}, welcome!`);
    });
});

function handleSignIn(socket, data) {
    if (data && data.id) {
        const { id, targetId } = data;
        console.log(`${id} signed in`);
        clients[id] = socket.id;

        if (targetId) {
            if (clients[targetId]) {
                io.to(clients[targetId]).emit('signedIn', { userId: id });
                socket.emit('signedIn', { userId: targetId });
            } else {
                console.log(`Target user with ID ${targetId} not found.`);
                socket.emit('errorMessage', { error: `Target user with ID ${targetId} not found.` });
            }
        }
    } else {
        console.log("Invalid data received during signIn:", data);
        socket.emit('errorMessage', { error: "Invalid data received during signIn" });
    }
}

function handleSendMessage(socket, msg) {
    console.log("Received message:", msg);
    const { senderId, targetId, message, imagePath, isImage } = msg;

    if (clients[targetId]) {
        msg.sendByMe = senderId;

        if (isImage) {
            msg.imagePath = imagePath;
        }

        io.to(clients[targetId]).emit('message-receive', msg);
    } else {
        console.log(`User with ID ${targetId} not found.`);
        socket.emit('errorMessage', { error: `User with ID ${targetId} not found.` });
    }
}


const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server running at https://chatapp-socket-ioo.onrender.com`);
});
