import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSocket } from "@/context/SocketProvider";
import { BackendResponse } from "@/types/types";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

const Lobby = () => {
  const [email, setEmail] = useState("armaaan@gmail.com");
  const [roomId, setRoomId] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const { socket } = useSocket();
  const navigator = useNavigate();

  const handleSubmit = () => {
    // setError("huhu");
    try {
      if (!email || !roomId) {
        throw new Error("Email and Room ID are required.");
      }

      if (!socket) {
        throw new Error("Socket connection is not available.");
      }

      socket.emit("room:join", { email, roomId });
      setError(null); // Clear error if successful
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoomJoin = useCallback((data: BackendResponse) => {
    try {
      const { email, roomId } = data;
      console.log(data);
      navigator(`/videoground/${roomId}`);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    socket?.on("room:join", handleRoomJoin);
    return () => {
      socket?.off("room:join", handleRoomJoin);
    };
  }, [socket, handleRoomJoin]);

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Enter Room</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="roomId">Room ID</Label>
          <Input
            id="roomId"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <Button className="w-full" onClick={handleSubmit}>
          Join Room
        </Button>
      </CardContent>
    </Card>
  );
};

export default Lobby;
