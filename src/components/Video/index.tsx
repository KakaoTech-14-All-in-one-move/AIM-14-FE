// components/Video/index.tsx
import Sidebar from '@/components/Home/Sidebar';
import Channelbar from '@/components/Home/Channelbar';
import { VideoContent } from '@/components/Video/VideoContent';

const Video = () => {
  console.log("Video component rendered");

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <Channelbar />
      <div className="flex-1 bg-black">
        <VideoContent />
      </div>
    </div>
  );
};

export default Video;