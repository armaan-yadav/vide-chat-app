import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.tsx";
import { ContextProvider } from "./context/ContextProvider.tsx";
import { SocketContextProvider } from "./context/SocketProvider.tsx";
import "./index.css";
import { StrictMode } from "react";

createRoot(document.getElementById("root")!).render(
  //<StrictMode>
  <BrowserRouter>
    <ContextProvider>
      <SocketContextProvider>
        <App />
      </SocketContextProvider>
    </ContextProvider>
  </BrowserRouter>
  //</StrictMode>
);
