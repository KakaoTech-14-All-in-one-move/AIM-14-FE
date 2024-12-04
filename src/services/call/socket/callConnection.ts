import { CALL_API, ERROR_CODES, OP_CODES, RECONNECT_DELAY } from '../constants';
import {
  CallUserData,
  ChannelEventData,
  ErrorData,
  MediaChannelType,
  VoiceStateUpdate,
  WebSocketMessage,
} from './types';
import { WebRTCConnection } from '../webrtc/WebRTCConnection';
import { useUserStore } from '@/stores/userStore';
import { useMediaStore } from '@/stores/mediaStore';
import { apiClient } from '@/api/apiClient';

type MessageHandler = (data: any) => void;
type MessageHandlerMap = Record<number, MessageHandler>;

export class CallConnection {
  private static instance: CallConnection | null = null;
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentServerId: string | null = null;
  private accessToken: string;

  private constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  static getInstance(accessToken?: string): CallConnection {
    if (!CallConnection.instance && accessToken) {
      CallConnection.instance = new CallConnection(accessToken);
    }
    return CallConnection.instance!;
  }

  setServerId(serverId: string | number | null) {
    this.currentServerId = serverId?.toString() || null;
  }

  updateServerConnection() {
    if (this.isConnected() && this.currentServerId) {
      this.sendOp(OP_CODES.SERVER, { server_id: this.currentServerId });
    }
  }

  private messageHandlers: MessageHandlerMap = {
    [OP_CODES.INIT_ACK]: (data: any) => {
      if (data?.heartbeat_interval) {
        this.setupHeartbeat(data.heartbeat_interval);
      }
    },

    [OP_CODES.SERVER_ACK]: (data: any) => {
      if (this.isCallUserData(data)) {
        const userStore = useUserStore.getState();
        this.currentServerId = data.server_id;
        userStore.setCurrentUser(data);
      }
    },

    [OP_CODES.ENTER_CHANNEL_EVENT]: (data: any) => {
      if (!data || !this.isCallUserData(data)) return;

      const userStore = useUserStore.getState();
      const currentUser = userStore.currentUser;

      // 현재 사용자 처리
      if (!currentUser || data.user_id === currentUser.user_id) {
        userStore.setCurrentUser(data);
      }

      // 채널에 있는 다른 사용자 처리
      const existingUser = userStore.users.find(u => u.user_id === data.user_id);
      if (!existingUser) {
        userStore.addUser(data);
        // 새로운 사용자와 WebRTC 연결 설정
        if (currentUser && data.user_id !== currentUser.user_id) {
          WebRTCConnection.getInstance().createPeerConnection(data.user_id);
        }
      } else {
        userStore.updateUser(data.user_id, data);
      }
    },

    [OP_CODES.LEAVE_CHANNEL_EVENT]: (data: ChannelEventData) => {
      if (!data?.user_id) return;

      const userStore = useUserStore.getState();
      const currentUser = userStore.currentUser;

      // 현재 사용자가 나가는 경우
      if (currentUser?.user_id === data.user_id) {
        userStore.setCurrentUser(null);
        WebRTCConnection.getInstance().closeAllConnections();
      } else {
        // 다른 사용자가 나가는 경우
        WebRTCConnection.getInstance().closePeerConnection(data.user_id);
        userStore.removeUser(data.user_id);
      }

      useMediaStore.getState().resetState();
    },

    [OP_CODES.UPDATE_STATE_EVENT]: (data: any) => {
      if (!this.isCallUserData(data)) return;

      const userStore = useUserStore.getState();
      userStore.updateUser(data.user_id, {
        muted: data.muted,
        deafened: data.deafened,
        speaking: data.speaking,
        camera_on: data.camera_on,
        screen_sharing: data.screen_sharing,
      });
    },

    [OP_CODES.ICE_CANDIDATE]: (data: any) => {
      if (data?.candidate && data?.user_id) {
        WebRTCConnection.getInstance().handleIceCandidate(
          data.user_id,
          data.candidate,
        );
      }
    },

    [OP_CODES.VIDEO_ANSWER]: (data: any) => {
      if (data?.sdp && data?.user_id) {
        WebRTCConnection.getInstance().handleVideoAnswer(
          data.user_id,
          data.sdp,
        );
      }
    },
  };

  async connect(): Promise<boolean> {
    try {
      const response = await apiClient.client.get<{ url: string }>(CALL_API.GET_WEBSOCKET_URL);
      if (!response.data.url) throw new Error('WebSocket URL not received');

      return this.setupWebSocket(response.data.url);
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  }

  private setupWebSocket(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.sendOp(OP_CODES.INIT, { token: this.accessToken });
        resolve(true);
      };

      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = () => {
        this.handleError();
        resolve(false);
      };

      setTimeout(() => resolve(false), 5000);
    });
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Error handling
      if (message.op === OP_CODES.ERROR && this.isErrorData(message.data)) {
        const errorName = Object.entries(ERROR_CODES).find(
          ([_, code]) => code === message.data.code,
        )?.[0] || 'UNKNOWN_ERROR';

        console.error('Server error:', {
          name: errorName,
          code: message.data.code,
          message: message.data.message,
        });

        // Handle specific error cases
        switch (message.data.code) {
          case ERROR_CODES.UNAUTHORIZED_ACCESS_TOKEN:
          case ERROR_CODES.UNAUTHORIZED_USER:
            this.disconnect();
            break;
          case ERROR_CODES.DUPLICATE_CHANNEL_ENTRY:
            // 중복 입장 시도 처리
            this.leaveChannel();
            break;
          case ERROR_CODES.INVALID_CHANNEL_ID:
            useMediaStore.getState().resetState();
            break;
        }
        return;
      }

      const handler = this.messageHandlers[message.op];
      if (handler) {
        handler(message.data);
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  };

  private handleClose = () => {
    this.cleanup();
    this.scheduleReconnect();
  };

  private handleError = () => {
    this.cleanup();
    this.scheduleReconnect();
  };

  async joinChannel(channelId: string, type: MediaChannelType): Promise<boolean> {
    if (!this.isConnected()) return false;

    const mediaStore = useMediaStore.getState();
    if (mediaStore.channelId) {
      this.leaveChannel();
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.ws?.removeEventListener('message', handleEnterEvent);
      };

      const handleEnterEvent = (event: MessageEvent) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (message.op === OP_CODES.ENTER_CHANNEL_EVENT && this.isCallUserData(message.data)) {
          cleanup();
          mediaStore.setChannelInfo(channelId, type);
          resolve(true);
        }
      };

      this.ws?.addEventListener('message', handleEnterEvent);

      this.sendOp(OP_CODES.ENTER_CHANNEL, {
        server_id: this.currentServerId,
        channel_id: channelId,
        channel_type: type,
      });
    });
  }

  leaveChannel() {
    const mediaStore = useMediaStore.getState();
    const channelId = mediaStore.channelId;
    if (!channelId) return;

    this.sendOp(OP_CODES.LEAVE_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: channelId,
      channel_type: mediaStore.channelType,
    });

    WebRTCConnection.getInstance().closeAllConnections();
    useUserStore.getState().resetState();
    mediaStore.resetState();
  }

  updateState(update: VoiceStateUpdate) {
    const mediaStore = useMediaStore.getState();
    if (!mediaStore.channelId) return;

    this.sendOp(OP_CODES.UPDATE_STATE, {
      server_id: this.currentServerId,
      channel_id: mediaStore.channelId,
      ...update,
    });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate) {
    this.sendOp(OP_CODES.ON_ICE_CANDIDATE, {
      target_user_id: targetUserId,
      candidate: candidate.toJSON(),
    });
  }

  sendVideoOffer(targetUserId: string, sdp: string) {
    this.sendOp(OP_CODES.RECEIVE_VIDEO, {
      target_user_id: targetUserId,
      sdp: sdp,
    });
  }

  private setupHeartbeat(interval: number) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendOp(OP_CODES.HEARTBEAT);
      }
    }, interval);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting reconnection...');
      this.connect();
      this.reconnectTimeout = null;
    }, RECONNECT_DELAY);
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendOp(op: number, data?: any) {
    if (!this.isConnected()) return;
    this.ws!.send(JSON.stringify({ op, data }));
  }

  private isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private isCallUserData(data: any): data is CallUserData {
    return (
      data &&
      typeof data.user_id === 'string' &&
      typeof data.username === 'string'
    );
  }

  private isErrorData(data: any): data is ErrorData {
    return (
      data &&
      typeof data.code === 'number' &&
      typeof data.message === 'string'
    );
  }

  disconnect() {
    this.cleanup();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    CallConnection.instance = null;
  }
}