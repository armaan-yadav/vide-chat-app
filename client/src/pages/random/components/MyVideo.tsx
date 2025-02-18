import { Video, VideoOff } from "lucide-react";
import React from "react";

type Props = {
  toggleVideo: () => void;
  isMyVideoEnabled: boolean;
  myVideoRef: React.RefObject<HTMLVideoElement | null>;
};

const MyVideo = ({ isMyVideoEnabled, myVideoRef, toggleVideo }: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-700">Your Video</h2>
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
  );
};

export default MyVideo;
