import React from "react";

type Props = {
  handleNext: () => void;
  isLoading: boolean;
  partnerId: string | null;
};

const Controls = (props: Props) => {
  return (
    <div className="flex justify-center">
      <button
        onClick={props.handleNext}
        disabled={props.isLoading || !props.partnerId}
        className="px-8 py-3 bg-blue-600 text-white rounded-full font-semibold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        Next Partner
      </button>
    </div>
  );
};

export default Controls;
