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
      // 1. 먼저 WebRTC 연결 시도
      const connected = await this.mediaManager.joinChannel(channelId, type);

      if (!connected) {
        console.error('Failed to connect to channel');
        return false;
      }

      // 2. 연결 성공 시에만 페이지 이동
      const path = type === 'VIDEO' ? `/video/${channelId}` : `/voice/${channelId}`;
      this.navigate(path);

      return true;

    } catch (error) {
      console.error('Channel enter failed:', error);

      // 3. 에러 발생 시 채널 나가기 시도
      try {
        await this.mediaManager.leaveChannel();
      } catch (cleanupError) {
        console.error('Failed to cleanup after failed channel enter:', cleanupError);
      }

      return false;
    }
  }

  async handleChannelLeave(): Promise<void> {
    if (!this.navigate) {
      console.error('Navigation function not set');
      return;
    }

    try {
      await this.mediaManager.leaveChannel();
      this.navigate('/channels');
    } catch (error) {
      console.error('Channel leave failed:', error);
      // 실패하더라도 채널 목록으로 이동
      this.navigate('/channels');
    }
  }

  dispose() {
    this.navigate = null;
    ChannelNavigator.instance = null;
  }
}