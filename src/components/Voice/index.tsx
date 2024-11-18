import Sidebar from '@/components/Home/Sidebar';
import Channelbar from '@/components/Home/Channelbar';
import { VoiceContent } from '@/components/Voice/VoiceContent';

const Voice = () => {  // export default 대신 named export 사용
  console.log("Voice component rendered"); // 디버깅용 로그

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <Channelbar />
      <div className="flex-1 bg-black">
        <VoiceContent />
      </div>
    </div>
  );
};

export default Voice;