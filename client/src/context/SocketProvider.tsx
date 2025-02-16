import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
}

export const SocketContext = createContext<SocketContextType>({ socket: null });

export const SocketContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const socket = useMemo(() => {
    // const host = window.location.hostname; // Gets current hostname (localhost or IP)
    // return io(`https://${host}:8000`);
    return io(`https://192.168.0.106:8000`);
  }, []);
  console.log(socket);
  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketContextProvider");
  }
  return context;
};
