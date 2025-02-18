import { useSocket } from "@/context/SocketProvider";
import { toast } from "@/hooks/use-toast";
import { ChatMessage } from "@/types/types";
import { Users } from "lucide-react";
import Peer from "peerjs";
import { useEffect, useRef, useState } from "react";
import Chat from "./components/Chat";
import Controls from "./components/Controls";
import MyVideo from "./components/MyVideo";
import PartnerVideo from "./components/PartnerVideo";

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
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null);

  const { socket } = useSocket();

  // socket ids
  const [localSocketId, setLocalSocketId] = useState<string | undefined>();
  const [remoteSocketId, setRemoteSocketId] = useState<string | undefined>();

  // Initialize video chat
  useEffect(() => {
    let mounted = true;

    const initializeVideoChat = async () => {
      try {
        setIsLoading(true);
        //initializing peer
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

          socket?.emit("findMatch", { peerId: id }); //sending my peer id
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

  useEffect(() => {}, []);

  //* Socket event handlers
  useEffect(() => {
    if (!socket) return;
    setLocalSocketId(socket.id);

    socket.on("userCount", ({ count }) => {
      setUserCount(count);
    });

    socket.on("matched", ({ partnerId, partnerSocketId }) => {
      toast({ title: "Connected with a new partner!" });
      setPartnerId(partnerId);
      setRemoteSocketId(partnerSocketId);

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

  //* Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  //* Handlers
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
      <div className="fixed top-4 right-4 bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-md">
        <Users className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-gray-700">{userCount} online</span>
      </div>

      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
          Video Chat<span className="text-blue-600">Roulette</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div>
            <span className="text-green-500">
              My Socket Id : ${localSocketId}
            </span>
            <MyVideo
              isMyVideoEnabled
              myVideoRef={myVideoRef}
              toggleVideo={toggleVideo}
            />
          </div>
          <div>
            <span className="text-red-600">
              Remote Socket Id : ${remoteSocketId}
            </span>
            <PartnerVideo
              partnerId={partnerId}
              partnerVideoRef={partnerVideoRef}
            />
          </div>
          {/*
           //TODO fix chat component [issue] : some messages not sending 
          // */}
          {/* <Chat
            chatContainerRef={chatContainerRef}
            handleSendMessage={handleSendMessage}
            handleTyping={handleTyping}
            messages={messages}
            newMessage={newMessage}
            partnerId={partnerId}
            partnerIsTyping={partnerIsTyping}
          /> */}
        </div>

        <Controls
          handleNext={handleNext}
          isLoading={isLoading}
          partnerId={partnerId}
        />
      </div>
    </div>
  );
};

export default VideoChatRoulette;
