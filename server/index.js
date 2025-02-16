import { Server } from "socket.io";
import { createServer } from "https";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ExpressPeerServer } from "peer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadSSLCertificates() {
  try {
    return {
      key: fs.readFileSync(path.join(__dirname, "cert", "key.pem")),
      cert: fs.readFileSync(path.join(__dirname, "cert", "cert.pem")),
    };
  } catch (error) {
    console.error("Failed to load SSL certificates:", error);
    process.exit(1);
  }
}

const app = express();
const sslServer = createServer(loadSSLCertificates(), app);

const peerServer = ExpressPeerServer(sslServer, {
  debug: true,
  path: "/myapp",
  ssl: loadSSLCertificates(),
});

peerServer.on("error", (error) => {
  console.error("PeerServer error:", error);
});

app.use("/peerjs", peerServer);

const port = 8000;

const io = new Server(sslServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 20000,
  pingInterval: 25000,
});
let totalActiveUsers = 0;
class UserManager {
  constructor() {
    this.waitingUsers = new Map();
    this.activePairs = new Map();
    this.emailToSocketId = new Map();
    this.socketIdToEmail = new Map();
  }

  addWaitingUser(socketId, userData) {
    if (!socketId || !userData.peerId) {
      throw new Error("Invalid user data");
    }
    this.waitingUsers.set(socketId, {
      ...userData,
      joinTime: Date.now(),
    });
  }

  removeWaitingUser(socketId) {
    this.waitingUsers.delete(socketId);
  }

  addActivePair(user1Id, user2Id) {
    if (!user1Id || !user2Id) {
      throw new Error("Invalid pair data");
    }
    this.activePairs.set(user1Id, user2Id);
    this.activePairs.set(user2Id, user1Id);
  }

  removeActivePair(socketId) {
    const partnerId = this.activePairs.get(socketId);
    if (partnerId) {
      this.activePairs.delete(socketId);
      this.activePairs.delete(partnerId);
      return partnerId;
    }
    return null;
  }

  getTotalUsers() {
    return this.waitingUsers.size + this.activePairs.size;
  }

  updateAndBroadcastUserCount(io) {
    const total = this.getTotalUsers();
    if (total !== totalActiveUsers) {
      totalActiveUsers = total;
      io.emit("userCount", { count: totalActiveUsers });
    }
  }
  getUserPartner(socketId) {
    return this.activePairs.get(socketId);
  }

  isUserInActivePair(socketId) {
    return this.activePairs.has(socketId);
  }
}

const userManager = new UserManager();
const MAX_WAIT_TIME = 5 * 60 * 1000;

function cleanWaitingList() {
  try {
    const now = Date.now();
    for (const [socketId, user] of userManager.waitingUsers.entries()) {
      if (now - user.joinTime > MAX_WAIT_TIME) {
        io.to(socketId).emit("match:timeout", {
          message: "Match timeout - Please try again",
        });
        userManager.removeWaitingUser(socketId);
      }
      if (!io.sockets.sockets.has(socketId)) {
        userManager.removeWaitingUser(socketId);
      }
    }
  } catch (error) {
    console.error("Error in cleanWaitingList:", error);
  }
}

async function findMatch(socket) {
  try {
    cleanWaitingList();

    if (userManager.activePairs.has(socket.id)) {
      return;
    }

    const availableUsers = Array.from(userManager.waitingUsers.entries())
      .filter(([id]) => id !== socket.id && io.sockets.sockets.has(id))
      .sort((a, b) => a[1].joinTime - b[1].joinTime);

    if (availableUsers.length > 0) {
      const [partnerId, partnerData] = availableUsers[0];
      const currentUserData = userManager.waitingUsers.get(socket.id);

      if (!currentUserData) {
        throw new Error("Current user data not found");
      }

      try {
        // Remove users from waiting list before attempting to match
        userManager.removeWaitingUser(partnerId);
        userManager.removeWaitingUser(socket.id);
        userManager.addActivePair(socket.id, partnerId);

        // Send match notifications with error handling
        await Promise.all([
          emitWithTimeout(socket.id, "matched", {
            partnerId: partnerData.peerId,
          }).catch((error) => {
            console.error(`Failed to notify user ${socket.id}:`, error);
            throw error;
          }),
          emitWithTimeout(partnerId, "matched", {
            partnerId: currentUserData.peerId,
          }).catch((error) => {
            console.error(`Failed to notify partner ${partnerId}:`, error);
            throw error;
          }),
        ]);

        console.log(
          `Successfully matched users: ${socket.id} with ${partnerId}`
        );
      } catch (error) {
        console.error("Error during match completion:", error);
        handleMatchFailure(socket.id, partnerId);

        // Add users back to waiting list if match fails
        if (io.sockets.sockets.has(socket.id)) {
          userManager.addWaitingUser(socket.id, currentUserData);
        }
        if (io.sockets.sockets.has(partnerId)) {
          userManager.addWaitingUser(partnerId, partnerData);
        }
      }
    }
  } catch (error) {
    console.error("Error in findMatch:", error);
    socket.emit("match:error", {
      message: "Failed to find match - Please try again",
    });
  }
}

function handleMatchFailure(user1Id, user2Id) {
  userManager.removeActivePair(user1Id);
  try {
    io.to(user1Id).emit("match:failed", {
      message: "Failed to establish connection",
    });
    io.to(user2Id).emit("match:failed", {
      message: "Failed to establish connection",
    });
  } catch (error) {
    console.error("Error in handleMatchFailure:", error);
  }
}

// Promise-based emit with timeout
function emitWithTimeout(socketId, event, data, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const socket = io.sockets.sockets.get(socketId);

    if (!socket) {
      reject(new Error(`Socket ${socketId} not found`));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Emit timeout for event ${event}`));
    }, timeout);

    socket.emit(event, data, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.emit("userCount", { count: userManager.getTotalUsers() });

  socket.on("chat:message", async (data) => {
    try {
      const { message } = data;
      if (!message || typeof message !== "string") {
        throw new Error("Invalid message format");
      }

      // Check if user is in an active pair
      const partnerId = userManager.getUserPartner(socket.id);
      if (!partnerId) {
        socket.emit("chat:error", {
          message: "No active chat partner found",
        });
        return;
      }

      // Create message object with timestamp
      const messageObj = {
        senderId: socket.id,
        message: message.trim(),
        timestamp: Date.now(),
      };

      // Send message to partner
      await emitWithTimeout(partnerId, "chat:message", messageObj);

      // Send confirmation back to sender
      socket.emit("chat:sent", {
        messageId: Date.now(), // You might want to use a proper ID generator
        timestamp: messageObj.timestamp,
      });
    } catch (error) {
      console.error("Error in chat:message handler:", error);
      socket.emit("chat:error", {
        message: "Failed to send message - Please try again",
      });
    }
  });

  socket.on("chat:typing", async (data) => {
    try {
      const { isTyping } = data;
      const partnerId = userManager.getUserPartner(socket.id);

      if (partnerId) {
        await emitWithTimeout(partnerId, "chat:typing", {
          isTyping: Boolean(isTyping),
        });
      }
    } catch (error) {
      console.error("Error in chat:typing handler:", error);
    }
  });

  socket.on("findMatch", async ({ peerId }) => {
    try {
      if (!peerId) {
        throw new Error("Invalid peer ID");
      }
      userManager.addWaitingUser(socket.id, { peerId });
      userManager.updateAndBroadcastUserCount(io);
      await findMatch(socket);
    } catch (error) {
      console.error("Error in findMatch handler:", error);
      socket.emit("match:error", {
        message: "Failed to initiate matching - Please try again",
        error: error.message,
      });
    }
  });

  socket.on("matched", (data) => {
    // Send acknowledgment back to server
    socket.emit("matched:ack");
  });

  socket.on("next", async () => {
    try {
      const partnerId = userManager.removeActivePair(socket.id);

      if (partnerId) {
        await emitWithTimeout(partnerId, "partnerLeft", {
          message: "Your partner has left the chat",
        });
      }

      userManager.addWaitingUser(socket.id, {
        peerId: socket.handshake.query.peerId,
      });

      await findMatch(socket);
    } catch (error) {
      console.error("Error in next handler:", error);
      socket.emit("next:error", {
        message: "Failed to find next partner - Please try again",
      });
    }
  });

  socket.on("disconnect", () => {
    try {
      const email = userManager.socketIdToEmail.get(socket.id);
      if (email) {
        userManager.emailToSocketId.delete(email);
        userManager.socketIdToEmail.delete(socket.id);
      }

      userManager.removeWaitingUser(socket.id);
      const partnerId = userManager.removeActivePair(socket.id);

      if (partnerId) {
        io.to(partnerId).emit("chat:ended", {
          message: "Your chat partner has disconnected",
        });

        // Update and broadcast new user count
        userManager.updateAndBroadcastUserCount(io);

        if (partnerId && io.sockets.sockets.has(partnerId))
          io.to(partnerId).emit("partnerLeft", {
            message: "Your partner has disconnected",
          });

        userManager.addWaitingUser(partnerId, {
          peerId: socket.handshake.query.peerId,
        });

        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) {
          findMatch(partnerSocket);
        }
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });

  // WebRTC signaling with error handling
  socket.on("call:incoming", async ({ to: answererId, offer }) => {
    try {
      await emitWithTimeout(answererId, "call:incoming", {
        offererId: socket.id,
        offer,
      });
    } catch (error) {
      console.error("Error in call:incoming handler:", error);
      socket.emit("call:error", {
        message: "Failed to establish call - Please try again",
      });
    }
  });

  socket.on("call:accepted", async ({ offererId, answer }) => {
    try {
      await emitWithTimeout(offererId, "call:accepted", {
        answererId: socket.id,
        answer,
      });
    } catch (error) {
      console.error("Error in call:accepted handler:", error);
      socket.emit("call:error", {
        message: "Failed to accept call - Please try again",
      });
    }
  });

  socket.on("peer:negotiation:needed", async ({ answererId, offer }) => {
    try {
      await emitWithTimeout(answererId, "peer:negotiation:needed", {
        offererId: socket.id,
        offer,
      });
    } catch (error) {
      console.error("Error in peer:negotiation:needed handler:", error);
      socket.emit("negotiation:error", {
        message: "Failed to negotiate connection - Please try again",
      });
    }
  });

  socket.on("peer:negotiation:done", async ({ offererId, answer }) => {
    try {
      await emitWithTimeout(offererId, "peer:negotiation:final", {
        answererId: socket.id,
        answer,
      });
    } catch (error) {
      console.error("Error in peer:negotiation:done handler:", error);
      socket.emit("negotiation:error", {
        message: "Failed to complete negotiation - Please try again",
      });
    }
  });
});

// Server error handling
sslServer.on("error", (error) => {
  console.error("Server error:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

try {
  sslServer.listen(port, () => {
    console.log("SSL server running on port:", port);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}
