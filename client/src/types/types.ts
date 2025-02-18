export interface BackendResponse {
  email: string;
  roomId: string;
}

export interface User {
  email: string;
  socketId: string;
}

export interface ChatMessage {
  senderId: string;
  message: string;
  timestamp: number;
  isMe?: boolean;
}
