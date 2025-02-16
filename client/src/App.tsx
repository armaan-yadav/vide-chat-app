import { Route, Routes } from "react-router";
import "./index.css";
import Lobby from "./pages/Lobby";
import VideoGround from "./pages/VideoGround";
import { Toaster } from "./components/ui/toaster";

const routes = (
  <Routes>
    <Route path="/" element={<Lobby />} />
    <Route path="/videoground/:roomId" element={<VideoGround />} />
  </Routes>
);
function App() {
  return (
    <>
      {routes}
      <Toaster />
    </>
  );
}

export default App;
