import { useNavigate } from 'react-router-dom';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager';
import { MediaType } from '@/services/call/types';

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

    try {
      // 1. 미디어 연결 시도
      const connected = await this.mediaManager.joinChannel(channelId, type);
      if (!connected) {
        throw new Error('Failed to connect to channel');
      }

      // 2. 연결 성공 시 페이지 이동
      const path = type === 'VIDEO' ? `/video/${channelId}` : `/voice/${channelId}`;
      this.navigate(path);

      return true;
    } catch (error) {
      console.error('Channel enter failed:', error);
      await this.mediaManager.leaveChannel();
      this.navigate('/channels');
      return false;
    }
  }

  async handleChannelLeave(): Promise<void> {
    if (!this.navigate!) {
      console.error('Navigation function not set');
      return;
    }

    try {
      await this.mediaManager.leaveChannel();
      this.navigate!('/channels');  // 저장된 navigate 함수 사용
    } catch (error) {
      console.error('Channel leave failed:', error);
      this.navigate!('/channels');  // 저장된 navigate 함수 사용
    }
  }

  dispose() {
    this.navigate = null;
    ChannelNavigator.instance = null;
  }
}