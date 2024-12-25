import { CALL_API, ERROR_CODES, OP_CODES, RECONNECT_DELAY } from '../constants';
import { MediaServerConnection } from '../webrtc/MediaServerConnection';
import { useUserChannelStore } from '@/stores/userChannelStore';
import { apiClient } from '@/api/apiClient';
import { MediaType } from '../types';
import { UserStateManager } from '@/services/call/UserStateManager';
import { useAuthStore } from '@/stores/authStore.ts';
import { MediaConnectionManager } from '@/services/call/MediaConnectionManager.ts';

type MessageHandler = (data: any) => void;
type MessageHandlerMap = Record<number, MessageHandler>;

interface ErrorData {
  code: number;
  message: string;
}

export class CallConnection {
  private static instance: CallConnection | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentServerId: string | null = null;
  private readonly accessToken: string;
  private connectionPromise: Promise<boolean> | null = null;
  private userStateManager: UserStateManager;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatIntervalTime: number = 0;
  private readonly INITIAL_CONNECTION_TIMEOUT = 30000; // 30초로 증가
  private readonly MAX_RECONNECT_DELAY = 60000;

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
      if (!data?.heartbeat_interval) {
        console.error('No heartbeat interval received in INIT_ACK');
        return;
      }

      // heartbeat_interval이 0이나 음수값인지 체크
      if (data.heartbeat_interval <= 0) {
        console.error('Invalid heartbeat interval received:', data.heartbeat_interval);
        return;
      }

      // 밀리초 변환을 더 명확하게
      let intervalMs: number;
      if (typeof data.heartbeat_interval === 'number') {
        // 이미 밀리초인지 체크 (너무 작은 값이면 초단위로 가정)
        if (data.heartbeat_interval < 100) { // 100ms 미만이면 초단위로 가정
          intervalMs = data.heartbeat_interval * 1000;
        } else {
          intervalMs = data.heartbeat_interval;
        }
      } else {
        intervalMs = parseInt(data.heartbeat_interval, 10);
        if (isNaN(intervalMs)) {
          console.error('Invalid heartbeat interval format:', data.heartbeat_interval);
          return;
        }
      }

      console.log('Setting up heartbeat with interval:', intervalMs / 1000, 's');
      this.setupHeartbeat(intervalMs);
    },

    [OP_CODES.SERVER_ACK]: (data: any) => {
      if (!this.currentServerId) return;

      // users 배열을 얻는 방법 수정
      const users = Array.isArray(data) ? data : [data];  // data 자체를 사용

      const channelUsers = users.map(user => {
        return {
          user_id: user.user_id,
          username: user.username,
          profile_image: user.profile_image,
          channel_id: typeof user.channel_id === 'number' ? user.channel_id.toString() : user.channel_id,
          muted: user.muted,
          deafened: user.deafened,
          camera_on: user.camera_on,
          screen_sharing: user.screen_sharing,  // 직접 값 전달
        };
      });

      this.userStateManager.handleServerState(channelUsers);
    },

    [OP_CODES.ENTER_CHANNEL_EVENT]: async (data: any) => {
      console.log('WEBSOCKET RECEIVED - CHANNEL ENTER : ', data);
      if (!data?.channel_id || !data?.user_id) return;

      const channelId = data.channel_id.toString();
      const currentUserId = useAuthStore.getState().user?.user_id.toString();

      // UserState 업데이트는 모든 경우에 수행
      const userData = {
        user_id: data.user_id,
        username: data.username,
        profile_image: data.profile_image,
        channel_id: channelId,
        channel_type: data.channel_type,
        muted: data.muted ?? false,
        deafened: data.deafened ?? false,
        camera_on: data.camera_on ?? (data.channel_type === 'VIDEO'),
        screen_sharing: data.screen_sharing ?? false,
        stream: null,
      };

      // 내가 입장한 경우
      if (data.user_id === currentUserId) {
        console.log('My channel enter - Creating WebRTC connections');
        // 1. 내 send peer 생성
        await MediaServerConnection.getInstance().createLocalPeer(
          channelId,
          currentUserId!,
          MediaServerConnection.getInstance().getLocalStream()!
        );

        // 2. 기존 채널 참가자들의 receive peer 생성
        const channelUsers = useUserChannelStore.getState().channelUsers.get(channelId) || [];
        for (const user of channelUsers) {
          if (user.userId !== currentUserId) {
            await MediaServerConnection.getInstance().createRemotePeer(channelId, user.userId);
          }
        }
      }
      // 다른 사람이 입장한 경우
      else {
        this.userStateManager.handleUserJoin(channelId, userData);
        // 현재 사용자가 해당 채널에 있는지 확인
        const { currentUserChannel } = useUserChannelStore.getState();
        if (currentUserChannel.channelId === channelId) {
          console.log('Other user channel enter - Creating receive peer');
          // 해당 유저의 receive peer 생성
          await MediaServerConnection.getInstance().createRemotePeer(channelId, data.user_id);
        } else {
          console.log('Skipping remote peer creation - current user not in channel:', channelId);
        }
      }
    },

    [OP_CODES.LEAVE_CHANNEL_EVENT]: (data: any) => {
      if (!data?.channel_id || !data?.user_id) return;

      // console.log('Leave channel event received:', data);
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

    [OP_CODES.RECEIVE_VIDEO_ANSWER]: (data: any) => {
      // console.log('RECEIVE_VIDEO_ANSWER', data);
      if (data?.sdpAnswer && data?.userId) {
        MediaServerConnection.getInstance().handleRemoteAnswer(data.sdpAnswer, data.userId);
      }
    },

    [OP_CODES.ICE_CANDIDATE]: (data: any) => {
      // console.log('ICE_CANDIDATE', data);
      if (data?.candidate && data?.userId) {
        MediaServerConnection.getInstance().handleIceCandidate(data.candidate, data.userId);
      }
    },

    [OP_CODES.CANCEL_VIDEO_ANSWER]: (data: any) => {
      const { currentUserChannel } = useUserChannelStore.getState();
      if (data?.userId) {
        console.log('Cancel sending peer for changing media stream : ', data.userId);
        // 기존 연결 정리 후 새 연결 시도
        MediaServerConnection.getInstance().prepareConnection(
          currentUserChannel.channelId!,
          data.userId,
          MediaServerConnection.getInstance().getLocalStream()!
        );
      }
    },
  };

  private reconnectCount = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  async connect(): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return true;  // 이미 연결된 경우 즉시 반환
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.reconnectCount >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return false;
    }

    this.connectionPromise = new Promise(async (resolve) => {
      try {
        const response = await apiClient.client.get<{ url: string }>(CALL_API.GET_WEBSOCKET_URL);
        if (!response.data.url) throw new Error('WebSocket URL not received');

        const connected = await this.setupWebSocket(response.data.url);
        if (connected) {
          this.reconnectCount = 0;  // 성공적인 연결 시 카운트 리셋
        } else {
          this.reconnectCount++;
        }
        this.connectionPromise = null;
        resolve(connected);
      } catch (error) {
        console.error('Connection failed:', error);
        this.reconnectCount++;
        this.connectionPromise = null;
        resolve(false);
      }
    });

    return this.connectionPromise;
  }

  private setupHeartbeat(interval: number) {
    // 이전 heartbeat interval이 있다면 제거
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // // 즉시 첫 번째 heartbeat 전송
    // if (this.isConnected()) {
    //   console.log('Sending initial heartbeat...', new Date().toISOString());
    //   this.sendOp(OP_CODES.HEARTBEAT);
    // }

    // 서버에서 받은 interval 그대로 사용 (5초를 빼지 않음)
    this.heartbeatIntervalTime = interval;

    // 새로운 interval 설정 (더 짧은 간격으로)
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        // console.log('Sending heartbeat...', new Date().toISOString());
        this.sendOp(OP_CODES.HEARTBEAT);
      } else {
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        this.scheduleReconnect();
      }
    }, Math.floor(interval * 0.9)); // interval의 90%로 설정하여 여유 시간 확보
  }

  private setupWebSocket(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      let isResolved = false;

      if (this.ws) {
        this.cleanup();
      }

      try {
        this.ws = new WebSocket(url);
      } catch (error) {
        console.error('WebSocket creation failed:', error);
        resolve(false);
        return;
      }

      // 초기 연결 타임아웃을 30초로 설정
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('WebSocket connection timed out after', this.INITIAL_CONNECTION_TIMEOUT / 1000, 'seconds');
          this.cleanup();
          resolve(false);
        }
      }, this.INITIAL_CONNECTION_TIMEOUT);

      this.ws.addEventListener('open', () => {
        isResolved = true;
        clearTimeout(timeoutId);

        if (this.isConnected()) {
          // WebSocket 연결 성공 로그 출력
          console.log('WebSocket connected successfully');

          // MediaServerConnection에 CallConnection 설정
          MediaServerConnection.getInstance().setCallConnection(this);
          MediaConnectionManager.getInstance().setCallConnection(this);
          UserStateManager.getInstance().resetJoinedUsers();

          // 초기화 메시지 전송
          this.sendOp(OP_CODES.INIT, { token: this.accessToken });

          if (this.heartbeatIntervalTime > 0) {
            this.setupHeartbeat(this.heartbeatIntervalTime);
          }
          resolve(true);
        } else {
          console.error('WebSocket connected but not in OPEN state');
          this.cleanup();
          resolve(false);
        }
      });

      // 에러 처리 개선
      this.ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          this.handleError();
          resolve(false);
        }
      });

      this.ws.addEventListener('message', this.handleMessage);
      this.ws.addEventListener('close', this.handleClose);
    });
  }

  // 재연결 로직 개선
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // 재연결 시도 간격을 점진적으로 증가 (최대 60초)
    const delay = Math.min(
      RECONNECT_DELAY * Math.pow(2, this.reconnectCount),  // 지수 백오프
      this.MAX_RECONNECT_DELAY,
    );

    this.reconnectTimeout = setTimeout(async () => {
      console.log(`Attempting reconnection... (attempt ${this.reconnectCount + 1}, delay: ${delay / 1000}s)`);
      const success = await this.connect();

      if (success) {
        console.log('Reconnection successful');
        this.reconnectCount = 0;

        if (this.currentServerId) {
          await this.setCurrentServerId(this.currentServerId);
        }
      } else {
        console.log(`Reconnection attempt ${this.reconnectCount + 1} failed`);
      }

      this.reconnectTimeout = null;
    }, delay);
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      if (message.op !== OP_CODES.ICE_CANDIDATE) {
        // console.log('Received message:', message);
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

  async setCurrentServerId(serverId: string): Promise<boolean> {
    this.currentServerId = serverId;
    return this.updateServerConnection();
  }

  private async updateServerConnection(): Promise<boolean> {
    if (!this.isConnected() || !this.currentServerId) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
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
      console.log('SEND CHANNEL ENTER - WEBSOCKET');
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