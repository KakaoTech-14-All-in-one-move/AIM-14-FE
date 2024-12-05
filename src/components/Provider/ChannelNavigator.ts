import { useNavigate } from 'react-router-dom';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager.ts';
import { MediaType } from '@/services/call/types.ts';

export class ChannelNavigator {
  private static instance: ChannelNavigator | null = null;
  private mediaManager: MediaConnectionManager;
  private navigate: ReturnType<typeof useNavigate> | null = null;

  private constructor() {
    this.mediaManager = MediaConnectionManager.getInstance();
  }

  static getInstance(): ChannelNavigator {
    if (!this.instance) {
      this.instance = new ChannelNavigator();
    }
    return this.instance;
  }

  setNavigate(navigate: ReturnType<typeof useNavigate>) {
    this.navigate = navigate;
  }

  async handleChannelEnter(channelId: string, type: MediaType): Promise<boolean> {
    if (!this.navigate) {
      console.error('Navigation function not set');
      return false;
    }

    // 1. 채널 타입에 따라 적절한 경로로 이동
    const path = type === 'VIDEO' ? `/video/${channelId}` : `/voice/${channelId}`;
    this.navigate(path);

    // 2. WebRTC 연결 시도
    const connected = await this.mediaManager.joinChannel(channelId, type);

    // TODO : 3. 연결 실패 시 Channel Leave
    if (!connected) {
      // alert('채널 연결에 실패했습니다.');
      return false;
    }

    return true;
  }

  dispose() {
    this.navigate = null;
    ChannelNavigator.instance = null;
  }
}