import { CALL_API, ERROR_CODES, OP_CODES, RECONNECT_DELAY } from '../constants';
import { MediaServerConnection } from '../webrtc/MediaServerConnection';
import { MediaConnectionManager } from '../MediaConnectionManager';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { apiClient } from '@/api/apiClient';
import { MediaType } from '@/services/call/types.ts';
import { useAuthStore } from '@/stores/authStore.ts';

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
  private mediaManager: MediaConnectionManager;

  private constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.mediaManager = MediaConnectionManager.getInstance();
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
      if (Array.isArray(data)) {
        // 서버 입장 시 기존 사용자 목록 초기화
        useUserChannelStore.getState().resetAllState();

        // 각 사용자 정보 처리
        data.forEach(userData => {
          if (userData.channel_id) {
            this.mediaManager.handleUserJoin(userData.channel_id, {
              user_id: userData.user_id,
              username: userData.username,
              profile_image: userData.profile_image,
              muted: userData.muted,
              deafened: userData.deafened,
              camera_on: userData.camera_on,
              screen_sharing: userData.screen_sharing,
              channel_id: userData.channel_id,
            });
          }
        });
      }
    },

    [OP_CODES.ENTER_CHANNEL_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;

      this.mediaManager.handleUserJoin(data.channel_id, {
        user_id: data.user_id,
        username: data.username,
        profile_image: data.profile_image,
        muted: data.muted,
        deafened: data.deafened,
        camera_on: data.camera_on,
        screen_sharing: data.screen_sharing,
        channel_id: data.channel_id,
      });
    },

    [OP_CODES.UPDATE_STATE_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;

      this.mediaManager.handleUserStateUpdate(data.channel_id, data.user_id, {
        isMuted: data.muted,
        isDeafened: data.deafened,
        isCameraOn: data.camera_on,
        isScreenSharing: data.screen_sharing,
      });
    },

    [OP_CODES.LEAVE_CHANNEL_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;
      this.mediaManager.handleUserLeave(data.channel_id, data.user_id);
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

  async updateServerConnection(): Promise<boolean> {
    if (!this.isConnected() || !this.currentServerId) {
      return false;
    }

    return new Promise((resolve) => {
      let isResolved = false;
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('Server join timeout');
          resolve(false);
        }
      }, 5000);

      // 서버 응답 핸들러
      const handleServerAck = (data: any) => {
        if (!this.currentServerId) return;

        // 기존 상태 초기화
        useUserChannelStore.getState().resetAllState();

        // 서버에서 전달된 사용자 데이터 처리
        if (Array.isArray(data)) {
          data.forEach(userData => {
            if (userData.channel_id) {
              this.mediaManager.handleUserJoin(userData.channel_id, userData);
            }
          });
        }

        // 프로세스 완료
        isResolved = true;
        clearTimeout(timeoutId);

        const currentUser = useAuthStore.getState().user;
        console.log('Entered server [', this.currentServerId, '] :', currentUser?.email);
        resolve(true);
      };

      // 일회성 이벤트 핸들러 등록
      const originalHandler = this.messageHandlers[OP_CODES.SERVER_ACK];
      this.messageHandlers[OP_CODES.SERVER_ACK] = (data: any) => {
        handleServerAck(data);
        if (originalHandler && !isResolved) {
          originalHandler(data);
        }
      };

      // 서버 입장 요청 전송
      this.sendOp(OP_CODES.SERVER, {
        server_id: this.currentServerId,
      });
    });
  }

  async setCurrentServerId(serverId: string) {
    this.currentServerId = serverId;
    return this.updateServerConnection();
  }

  async joinChannel(channelId: string, type: MediaType) {
    if (!this.isConnected()) {
      console.error('WebSocket is not connected');
      return false;
    }

    return new Promise((resolve) => {
      let isResolved = false;
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('Channel join timed out');
          resolve(false);
        }
      }, 5000);

      isResolved = true;
      clearTimeout(timeoutId);
      resolve(true);

      console.log('SEND CHANNEL ENTER');
      this.sendOp(OP_CODES.ENTER_CHANNEL, {
        server_id: this.currentServerId,
        channel_id: channelId,
        channel_type: type,
      });
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