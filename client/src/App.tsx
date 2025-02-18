import { Route, Routes } from "react-router";
import "./index.css";
import Lobby from "./pages/Lobby";
import VideoGround from "./pages/VideoGround";
import { Toaster } from "./components/ui/toaster";
import Random from "./pages/random/Random";

const routes = (
  <Routes>
    <Route path="/" element={<Lobby />} />
    <Route path="/videoground/:roomId" element={<VideoGround />} />
    <Route path="/random" element={<Random />} />
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
