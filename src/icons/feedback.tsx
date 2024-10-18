const FeedbackIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="w-8 h-8"
    >
      {/* 말풍선 모양 */}
      <path
        d="M50 2C25.43 2 4 23.33 4 50c0 11.84 4.09 22.82 10.1 30.36V98l20.66-13.15C41.03 89.3 45.02 90 50 90c24.57 0 46-21.33 46-40S74.57 2 50 2z"
        fill="#3B1E1E"
      />
      {/* AI 텍스트 */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="36"
      >
        AI
      </text>
    </svg>
  );
};

export default FeedbackIcon;
