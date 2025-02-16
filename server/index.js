import { Server } from "socket.io";
import { createServer } from "https";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const sslServer = createServer(
  {
    key: fs.readFileSync(path.join(__dirname, "cert", "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "cert", "cert.pem")),
  },
  app
);

const port = 8000;

const io = new Server(sslServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();

let users = [];

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  //* HANDLE JOIN ROOM
  socket.on("room:join", (data) => {
    const { email, roomId } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketIdToEmailMap.set(socket.id, email);

    socket.join(roomId);
    console.log("User joined room:", data);

    io.to(roomId).emit("user:joined", { email, socketId: socket.id });
    io.to(socket.id).emit("room:join", data);
  });

  //* HANDLE CALL INCOMING
  socket.on("call:incoming", ({ to: answererId, offer }) => {
    io.to(answererId).emit("call:incoming", { offererId: socket.id, offer });
  });

  //* HANDLE CALL ACCEPTED
  socket.on("call:accepted", ({ offererId, answer }) => {
    io.to(offererId).emit("call:accepted", { answererId: socket.id, answer });
  });
  //* HANDLE NEGOTIATION NEEDED
  socket.on("peer:negotiation:needed", ({ answererId, offer }) => {
    console.log("triggered from  : ", socket.id);
    console.log("asnwererId : ", answererId);

    console.log("peer:negotiation:needed handled in server", offer);
    io.to(answererId).emit("peer:negotiation:needed", {
      offererId: socket.id,
      offer,
    });
    console.log("peer:negotiation:needed emitted to client");
  });
  //* HANDLE NEGOTIAION DONE
  socket.on("peer:negotiation:done", ({ offererId, answer }) => {
    console.log("peer:negotiation:done handled");

    io.to(offererId).emit("peer:negotiation:final", {
      answererId: socket.id,
      answer,
    });
    console.log("peer:negotiation:final emitted to client");
  });

  //* HANDLE DISCONNECTION
  socket.on("disconnect", () => {
    const email = socketIdToEmailMap.get(socket.id);
    if (email) {
      emailToSocketIdMap.delete(email);
      socketIdToEmailMap.delete(socket.id);
    }
    console.log("Socket disconnected:", socket.id);
  });
});

sslServer.listen(port, () => {
  console.log("SSL server running on port:", port);
});
