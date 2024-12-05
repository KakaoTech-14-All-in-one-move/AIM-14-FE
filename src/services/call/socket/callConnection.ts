import { CALL_API, ERROR_CODES, OP_CODES, RECONNECT_DELAY } from '../constants';
import { MediaServerConnection } from '../webrtc/MediaServerConnection';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { apiClient } from '@/api/apiClient';
import { MediaType } from '../types';
import { UserStateManager } from '@/services/call/UserStateManager';

type MessageHandler = (data: any) => void;
type MessageHandlerMap = Record<number, MessageHandler>;

interface ErrorData {
  code: number;
  message: string;
}

export class CallConnection {
  private static instance: CallConnection | null = null;
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentServerId: string | null = null;
  private readonly accessToken: string;
  private connectionPromise: Promise<boolean> | null = null;
  private userStateManager: UserStateManager;

  private constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.userStateManager = UserStateManager.getInstance();
  }

  static getInstance(accessToken?: string): CallConnection {
    if (!CallConnection.instance && accessToken) {
      CallConnection.instance = new CallConnection(accessToken);
    }
    return CallConnection.instance!;
  }

  private messageHandlers: MessageHandlerMap = {
    [OP_CODES.INIT_ACK]: (data: any) => {
      if (data?.heartbeat_interval) {
        this.setupHeartbeat(data.heartbeat_interval);
      }
    },

    [OP_CODES.SERVER_ACK]: (data: any) => {
      if (!this.currentServerId) return;

      // data가 배열인지 확인하고 처리
      const users = Array.isArray(data) ? data : [];

      // 서버에서 온 데이터를 UserData 형식으로 매핑
      const channelUsers = users.map(user => ({
        user_id: user.user_id,
        username: user.username,
        profile_image: user.profile_image,
        channel_id: user.channel_id.toString(),
        muted: user.muted,
        deafened: user.deafened,
        camera_on: user.camera_on,
        screen_sharing: false,  // 초기값
      }));

      // UserStateManager를 통해 상태 업데이트
      this.userStateManager.handleServerState(channelUsers);
    },

    [OP_CODES.ENTER_CHANNEL_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;
      console.log('Socket ENTER_CHANNEL_EVENT received:', data);

      const userData = {
        user_id: data.user_id,
        username: data.username,
        profile_image: data.profile_image,
        channel_id: data.channel_id.toString(),
        channel_type: data.channel_type,
        muted: data.muted ?? false,
        deafened: data.deafened ?? false,
        camera_on: data.camera_on ?? (data.channel_type === 'VIDEO'),
        screen_sharing: data.screen_sharing ?? false,
      };

      console.log('Processed userData for channel join:', userData);
      this.userStateManager.handleUserJoin(data.channel_id.toString(), userData);
    },

    [OP_CODES.LEAVE_CHANNEL_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;

      console.log('Leave channel event received:', data);
      const channelId = data.channel_id.toString();

      this.userStateManager.handleUserLeave(channelId, data.user_id);
    },

    [OP_CODES.UPDATE_STATE_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;

      // channelId를 string으로 변환
      const channelId = data.channel_id.toString();

      // 빈 객체가 아닌 실제 상태 값 전달
      this.userStateManager.handleUserStateUpdate(channelId, data.user_id, {
        muted: data.muted,
        deafened: data.deafened,
        camera_on: data.camera_on,
        screen_sharing: data.screen_sharing,
        // 다른 필요한 상태들도 추가
      });
    },

    [OP_CODES.VIDEO_ANSWER]: (data: any) => {
      if (data?.sdpAnswer) {
        MediaServerConnection.getInstance().handleRemoteAnswer(data.sdpAnswer);
      }
    },

    [OP_CODES.ICE_CANDIDATE]: (data: any) => {
      if (data?.candidate) {
        MediaServerConnection.getInstance().handleIceCandidate(data.candidate);
      }
    },
  };

  async connect(): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve) => {
      try {
        const response = await apiClient.client.get<{ url: string }>(CALL_API.GET_WEBSOCKET_URL);
        if (!response.data.url) throw new Error('WebSocket URL not received');

        const connected = await this.setupWebSocket(response.data.url);
        this.connectionPromise = null;
        resolve(connected);
      } catch (error) {
        console.error('Connection failed:', error);
        this.connectionPromise = null;
        resolve(false);
      }
    });

    return this.connectionPromise;
  }

  private setupWebSocket(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      let isResolved = false;

      this.ws = new WebSocket(url);

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('WebSocket connection timed out');
          this.cleanup();
          resolve(false);
        }
      }, 5000);

      this.ws.addEventListener('open', () => {
        isResolved = true;
        clearTimeout(timeoutId);
        this.sendOp(OP_CODES.INIT, { token: this.accessToken });
        resolve(true);
      });

      this.ws.addEventListener('message', this.handleMessage);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          this.handleError();
          resolve(false);
        }
      });
    });
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      if (message.op !== OP_CODES.ICE_CANDIDATE) {
        console.log('Received message:', message);
      }

      if (message.op === OP_CODES.ERROR && this.isErrorData(message.data)) {
        this.handleErrorMessage(message.data);
        return;
      }

      const handler = this.messageHandlers[message.op];
      if (handler) {
        if (message.data && 'data' in message.data) {
          handler(message.data.data);
        } else {
          handler(message.data);
        }
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  };

  private handleErrorMessage(error: ErrorData) {
    const errorName = Object.entries(ERROR_CODES).find(
      ([_, code]) => code === error.code,
    )?.[0] || 'UNKNOWN_ERROR';

    console.error('Server error:', {
      name: errorName,
      code: error.code,
      message: error.message,
    });

    if (error.code === ERROR_CODES.UNAUTHORIZED_ACCESS_TOKEN ||
      error.code === ERROR_CODES.UNAUTHORIZED_USER) {
      this.disconnect();
    }
  }

  private handleClose = () => {
    this.cleanup();
    this.scheduleReconnect();
  };

  private handleError = () => {
    this.cleanup();
    this.scheduleReconnect();
  };

  async setCurrentServerId(serverId: string) {
    this.currentServerId = serverId;
    return this.updateServerConnection();
  }

  private async updateServerConnection(): Promise<boolean> {
    if (!this.isConnected() || !this.currentServerId) {
      return false;
    }

    return new Promise((resolve) => {
      this.sendOp(OP_CODES.SERVER, {
        server_id: this.currentServerId,
      });
      resolve(true);
    });
  }

  async joinChannel(channelId: string, type: MediaType) {
    if (!this.isConnected()) {
      console.error('WebSocket is not connected');
      return false;
    }

    return new Promise((resolve) => {
      console.log('SEND CHANNEL ENTER');
      this.sendOp(OP_CODES.ENTER_CHANNEL, {
        server_id: this.currentServerId,
        channel_id: channelId,
        channel_type: type,
      });
      resolve(true);
    });
  }

  leaveChannel() {
    const { currentUserChannel } = useUserChannelStore.getState();
    if (!currentUserChannel.channelId) return;

    this.sendOp(OP_CODES.LEAVE_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: currentUserChannel.channelId,
      channel_type: currentUserChannel.channelType,
    });
  }

  updateState(updates: any) {
    const { currentUserChannel } = useUserChannelStore.getState();
    if (!currentUserChannel.channelId) return;

    this.sendOp(OP_CODES.UPDATE_STATE, {
      server_id: this.currentServerId,
      channel_id: currentUserChannel.channelId,
      ...updates,
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
      this.ws.removeEventListener('message', this.handleMessage);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.close();
      this.ws = null;
    }
  }

  sendOp(op: number, data?: any) {
    if (!this.isConnected()) return;

    try {
      this.ws!.send(JSON.stringify({ op, data }));
    } catch (error) {
      console.error('Error sending operation:', error);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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