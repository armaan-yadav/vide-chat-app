import React from "react";

type Props = {
  partnerVideoRef: React.RefObject<HTMLVideoElement | null>;
  partnerId: String | null;
};

const PartnerVideo = ({ partnerId, partnerVideoRef }: Props) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-700">Partner's Video</h2>
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
              <p className="text-gray-600 font-medium">Finding a partner...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerVideo;
