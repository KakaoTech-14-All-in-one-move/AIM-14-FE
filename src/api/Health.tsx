const Health = () => {
  // 타임스탬프를 hidden input으로 추가하여 매번 새로운 응답 생성
  return <input type="hidden" value={Date.now()} />;
};

export default Health;