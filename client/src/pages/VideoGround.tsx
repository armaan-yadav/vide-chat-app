import { Button } from "@/components/ui/button";
import { useSocket } from "@/context/SocketProvider";
import { toast } from "@/hooks/use-toast";
import PeerService from "@/services/PeerService";
import { User } from "@/types/types";
import { useCallback, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import { Link, useParams } from "react-router";

const VideoGround = () => {
  const [answerer, setAnswerer] = useState<User | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const { roomId } = useParams();
  const { socket } = useSocket();
  const [errors, setErrors] = useState<string[]>([]);

  const addUser = (user: User) => {
    setAnswerer(user);
  };

  const handleUserJoined = useCallback((user: User) => {
    toast({ title: `${user.email} joined the room` });
    addUser(user);
  }, []);

  const handleOutgoingCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setLocalStream(stream);
      setIsCameraOn(true);
      // Get and send offer before adding tracks
      const offer = await PeerService.getOffer();
      socket?.emit("call:incoming", { to: answerer?.socketId, offer });

      setErrors([]);
    } catch (error) {
      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      setErrors((prev) => [...prev, errorMessage]);
    }
  };
  const handleIncomingCall = useCallback(
    async ({
      offererId,
      offer,
    }: {
      offererId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        toast({ title: "incoming call" });
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setLocalStream(stream);

        // First get and send answer
        const answer = await PeerService.getAnswer(offer);
        socket?.emit("call:accepted", { offererId, answer });

        // Then add tracks
        for (const track of stream.getTracks()) {
          PeerService.peer?.addTrack(track, stream);
        }

        setErrors([]);
      } catch (error) {
        console.log(error);
        let errorMessage = "An unknown error occurred during incoming call";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }
        setErrors((prev) => [...prev, errorMessage]);
      }
    },
    [socket]
  );
  const handleAcceptedCall = useCallback(
    async ({
      answer,
    }: {
      answererId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        await PeerService.setRemoteDesription(answer);

        // Add tracks after remote description is set
        if (localStream) {
          for (const track of localStream.getTracks()) {
            PeerService.peer?.addTrack(track, localStream);
          }
        }

        toast({ title: "call accepted" });
      } catch (error) {
        console.error("Error in handleAcceptedCall:", error);
        toast({ title: "Error setting up remote connection" });
      }
    },
    [localStream] // Add localStream to dependencies
  );

  const handleNegotiaionNeeded = useCallback(async () => {
    try {
      const offer = await PeerService.getOffer();
      socket?.emit("peer:negotiation:needed", {
        answererId: answerer?.socketId,
        offer,
      });
    } catch (error) {
      console.error("Error in negotiation:", error);
      toast({ title: "Error during call negotiation" });
    }
  }, [answerer, socket]);

  const handleNegotiationIncoming = useCallback(
    async ({
      offererId,
      offer,
    }: {
      offererId: String;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        const answer = await PeerService.getAnswer(offer);
        socket?.emit("peer:negotiation:done", { offererId, answer });
      } catch (error) {
        console.error("Error handling negotiation:", error);
        toast({ title: "Error during call setup" });
      }
    },
    [socket]
  );

  const handleNegotiaionFinal = useCallback(
    async ({
      answer,
    }: {
      answererId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        await PeerService.setRemoteDesription(answer);
      } catch (error) {
        console.error("Error in final negotiation:", error);
        toast({ title: "Error finalizing call setup" });
      }
    },
    []
  );

  const handleTrackEvent = useCallback((ev: RTCTrackEvent) => {
    const [remoteStream] = ev.streams;
    console.log("Received remote stream:", remoteStream);
    setRemoteStream(remoteStream);
  }, []);

  useEffect(() => {
    const peer = PeerService.peer;
    if (peer) {
      peer.addEventListener("track", handleTrackEvent);
      return () => {
        peer.removeEventListener("track", handleTrackEvent);
      };
    }
  }, [handleTrackEvent]);

  useEffect(() => {
    const peer = PeerService.peer;
    if (peer) {
      peer.addEventListener("negotiationneeded", handleNegotiaionNeeded);
      return () => {
        peer.removeEventListener("negotiationneeded", handleNegotiaionNeeded);
      };
    }
  }, [handleNegotiaionNeeded]);

  useEffect(() => {
    socket?.on("user:joined", handleUserJoined);
    socket?.on("call:incoming", handleIncomingCall);
    socket?.on("call:accepted", handleAcceptedCall);
    socket?.on("peer:negotiation:needed", handleNegotiationIncoming);
    socket?.on("peer:negotiation:final", handleNegotiaionFinal);

    return () => {
      socket?.off("user:joined", handleUserJoined);
      socket?.off("call:incoming", handleIncomingCall);
      socket?.off("call:accepted", handleAcceptedCall);
      socket?.off("peer:negotiation:needed", handleNegotiationIncoming);
      socket?.off("peer:negotiation:final", handleNegotiaionFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncomingCall,
    handleAcceptedCall,
    handleNegotiaionFinal,
    handleNegotiationIncoming,
  ]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Link to="/" className="text-xl font-bold">
        HOME
      </Link>

      <h1 className="text-2xl font-bold">Welcome to VideoGround :)</h1>

      <p className="text-lg">Room Id : {roomId}</p>

      <p className="text-lg">My Socket : {socket?.id}</p>

      {answerer && (
        <p className="text-xl font-bold text-green-500">CONNECTED</p>
      )}

      <div className="flex gap-4">
        {answerer && (
          <p className="text-lg">
            {answerer.email} : {answerer.socketId}
          </p>
        )}
      </div>

      <div className="flex gap-4">
        {answerer && <Button onClick={handleOutgoingCall}>CALL</Button>}
      </div>

      <div className="flex gap-4">
        {localStream && (
          <div className="border rounded-lg p-2">
            <h2 className="text-lg font-bold mb-2">Local Stream</h2>
            <ReactPlayer
              playing
              muted
              height="300px"
              width="500px"
              url={localStream}
            />
          </div>
        )}
        {remoteStream && (
          <div className="border rounded-lg p-2">
            <h2 className="text-lg font-bold mb-2">Remote Stream</h2>
            <ReactPlayer
              playing
              muted
              height="300px"
              width="500px"
              url={remoteStream}
            />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-100 rounded-lg">
          <h3 className="font-bold text-red-800 mb-2">Errors:</h3>
          {errors.map((error, index) => (
            <p key={index} className="text-red-700">
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoGround;
