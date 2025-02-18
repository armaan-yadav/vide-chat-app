import { ChatMessage } from "@/types/types";
import { Send } from "lucide-react";
import React from "react";

type Props = {
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  partnerIsTyping: boolean;
  newMessage: string;
  handleTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSendMessage: () => void;
  partnerId: string | null;
};

const Chat = ({
  chatContainerRef,
  handleSendMessage,
  handleTyping,
  messages,
  newMessage,
  partnerIsTyping,
  partnerId,
}: Props) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-700">Chat</h2>
      <div className="rounded-xl overflow-hidden shadow-lg bg-white flex flex-col h-[400px]">
        <div
          ref={chatContainerRef}
          className="flex-1 p-4 space-y-4 overflow-y-auto"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 ${
                  msg.isMe
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <p>{msg.message}</p>
                <p className="text-xs opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {partnerIsTyping && (
            <div className="text-sm text-gray-500">Partner is typing...</div>
          )}
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message..."
              disabled={!partnerId}
              className="flex-1 px-4 py-2 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!partnerId || !newMessage.trim()}
              className="p-2 rounded-full bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
