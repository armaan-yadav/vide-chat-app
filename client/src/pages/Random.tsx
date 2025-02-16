import { useEffect, useState, useRef } from "react";
import Peer from "peerjs";
import { useSocket } from "@/context/SocketProvider";
import { toast } from "@/hooks/use-toast";
import { Users, Video, VideoOff, Send } from "lucide-react";

interface ChatMessage {
  senderId: string;
  message: string;
  timestamp: number;
  isMe?: boolean;
}

interface Stream extends MediaStream {
  active: boolean;
}

const VideoChatRoulette = () => {
  // State for peer connection and video
  const [myPeerId, setMyPeerId] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMyVideoEnabled, setIsMyVideoEnabled] = useState(true);
  const [userCount, setUserCount] = useState(0);

  // State for chat functionality
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);

  // Refs
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const peerInstance = useRef<Peer | null>(null);
  const myStreamRef = useRef<Stream | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const { socket } = useSocket();

  // Initialize video chat
  useEffect(() => {
    let mounted = true;

    const initializeVideoChat = async () => {
      try {
        setIsLoading(true);

        const peer = new Peer({
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
          },
          debug: 3,
        });

        peer.on("open", (id) => {
          if (!mounted) return;
          setMyPeerId(id);
          socket?.emit("findMatch", { peerId: id });
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        myStreamRef.current = stream as Stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }

        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (partnerStream) => {
            if (!mounted || !partnerVideoRef.current) return;
            partnerVideoRef.current.srcObject = partnerStream;
          });
        });

        peerInstance.current = peer;
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        toast({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "Failed to initialize video chat",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    initializeVideoChat();

    return () => {
      mounted = false;
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, [socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on("userCount", ({ count }) => {
      setUserCount(count);
    });

    socket.on("matched", ({ partnerId }) => {
      toast({ title: "Connected with a new partner!" });
      setPartnerId(partnerId);

      if (!myStreamRef.current || !peerInstance.current) return;
      const call = peerInstance.current.call(partnerId, myStreamRef.current);

      call.on("stream", (partnerStream) => {
        if (!partnerVideoRef.current) return;
        partnerVideoRef.current.srcObject = partnerStream;
      });
    });

    socket.on("partnerLeft", () => {
      toast({ title: "Partner disconnected" });
      setPartnerId(null);
      setMessages([]);
      if (partnerVideoRef.current) {
        partnerVideoRef.current.srcObject = null;
      }
    });

    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, { ...message, isMe: false }]);
    });

    socket.on("chat:typing", ({ isTyping }) => {
      setPartnerIsTyping(isTyping);
    });

    return () => {
      socket.off("userCount");
      socket.off("matched");
      socket.off("partnerLeft");
      socket.off("chat:message");
      socket.off("chat:typing");
    };
  }, [socket]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handlers
  const handleNext = () => {
    if (!socket) return;
    if (partnerVideoRef.current) {
      partnerVideoRef.current.srcObject = null;
    }
    setMessages([]);
    socket.emit("next");
    setPartnerId(null);
  };

  const toggleVideo = () => {
    if (myStreamRef.current) {
      const videoTrack = myStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsMyVideoEnabled(!isMyVideoEnabled);
      }
    }
  };

  const handleSendMessage = () => {
    if (!socket || !newMessage.trim() || !partnerId) return;

    const messageData = {
      message: newMessage.trim(),
      timestamp: Date.now(),
      senderId: myPeerId,
      isMe: true,
    };

    socket.emit("chat:message", { message: newMessage.trim() });
    setMessages((prev) => [...prev, messageData]);
    setNewMessage("");
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("chat:typing", { isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("chat:typing", { isTyping: false });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 md:p-6">
      {/* User Count */}
      <div className="fixed top-4 right-4 bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-md">
        <Users className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-gray-700">{userCount} online</span>
      </div>

      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
          Video Chat<span className="text-blue-600">Roulette</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* My Video */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-700">
                Your Video
              </h2>
              <button
                onClick={toggleVideo}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                {isMyVideoEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden shadow-lg bg-white">
              <video
                ref={myVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-full text-white text-sm">
                You
              </div>
            </div>
          </div>

          {/* Partner Video */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">
              Partner's Video
            </h2>
            <div className="relative rounded-xl overflow-hidden shadow-lg bg-white">
              <video
                ref={partnerVideoRef}
                autoPlay
                playsInline
                className="w-full aspect-video object-cover"
              />
              {!partnerId && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                    <p className="text-gray-600 font-medium">
                      Finding a partner...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat */}
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
                    className={`flex ${
                      msg.isMe ? "justify-end" : "justify-start"
                    }`}
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
                  <div className="text-sm text-gray-500">
                    Partner is typing...
                  </div>
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
        </div>

        {/* Controls */}
        <div className="flex justify-center">
          <button
            onClick={handleNext}
            disabled={isLoading || !partnerId}
            className="px-8 py-3 bg-blue-600 text-white rounded-full font-semibold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next Partner
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoChatRoulette;
