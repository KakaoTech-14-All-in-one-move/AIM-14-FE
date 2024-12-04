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
import { apiClient } from '@/api/apiClient';
import { useAuthStore } from '@/stores/authStore.ts';

type MessageHandler = (data: any) => void;
type MessageHandlerMap = Record<number, MessageHandler>;

export class CallConnection {
  private static instance: CallConnection | null = null;
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentServerId: string | null = null;
  private accessToken: string;
  private connectionPromise: Promise<boolean> | null = null;

  private constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  static getInstance(accessToken?: string): CallConnection {
    if (!CallConnection.instance && accessToken) {
      CallConnection.instance = new CallConnection(accessToken);
    }
    return CallConnection.instance!;
  }

  async setServerId(serverId: string | number | null): Promise<boolean> {
    this.currentServerId = serverId?.toString() || null;
    if (this.currentServerId) {
      return this.updateServerConnection();
    }
    return false;
  }

  async updateServerConnection(): Promise<boolean> {
    if (!this.isConnected() || !this.currentServerId) {
      return false;
    }

    return new Promise((resolve) => {
      let isResolved = false;
      const timeoutDuration = 5000;

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('Server join timeout');
          resolve(false);
        }
      }, timeoutDuration);

      const handleServerAck = (data: any) => {

        if (!this.currentServerId) return;

        const userStore = useUserStore.getState();

        // 빈 값이거나 빈 객체인 경우도 valid한 응답으로 처리
        if (data === null || data === undefined || Object.keys(data).length === 0) {
          userStore.resetState();
          isResolved = true;
          clearTimeout(timeoutId);
          resolve(true);
          return;
        }

        // 배열인 경우 처리
        if (Array.isArray(data)) {
          userStore.resetState();

          // 사용자 목록이 있는 경우 처리
          if (data.length > 0) {
            data.forEach(userData => {
              if (this.isCallUserData(userData)) {
                userStore.addUser(userData);
              }
            });
          }

          isResolved = true;
          clearTimeout(timeoutId);
          resolve(true);
          return;
        }

        // 단일 사용자 데이터 처리 (이전 버전 호환성)
        // if (this.isCallUserData(data) && String(data.server_id) === String(this.currentServerId)) {
        //   userStore.setCurrentUser(data);
        //   isResolved = true;
        //   clearTimeout(timeoutId);
        //   resolve(true);
        //   return;
        // }

        console.error('Invalid server ack data:', data);
      };

      // 일회성 이벤트 핸들러 등록
      const originalHandler = this.messageHandlers[OP_CODES.SERVER_ACK];
      this.messageHandlers[OP_CODES.SERVER_ACK] = (data: any) => {
        handleServerAck(data);
        if (originalHandler && !isResolved) {
          originalHandler(data);
        }
        console.log('Entered server [', this.currentServerId, '] :', useAuthStore.getState().user?.email);
      };

      // 서버 입장 요청 전송
      this.sendOp(OP_CODES.SERVER, {
        server_id: this.currentServerId,
      });
      return true;
    });
  }


  private messageHandlers: MessageHandlerMap = {
    [OP_CODES.INIT_ACK]: (data: any) => {
      if (data?.heartbeat_interval) {
        this.setupHeartbeat(data.heartbeat_interval);
      }
    },

    // [OP_CODES.SERVER_ACK]: (data: any) => {
    //   console.log("SERVER_ACK : ", data)
    //   if (Array.isArray(data)) {
    //     const userStore = useUserStore.getState();
    //
    //     // 기존 사용자 목록 초기화
    //     userStore.resetState();
    //
    //     // 채널에 접속 중인 사용자들 추가
    //     data.forEach(userData => {
    //       if (this.isCallUserData(userData)) {
    //         userStore.addUser(userData);
    //       }
    //     });
    //     return;
    //   }
    //
    //   // 단일 사용자 데이터 처리 (이전 버전 호환성)
    //   if (this.isCallUserData(data)) {
    //     const userStore = useUserStore.getState();
    //     this.currentServerId = data.server_id;
    //     userStore.setCurrentUser(data);
    //     console.log('Entered server:', this.currentServerId);
    //   }
    // },

    [OP_CODES.ENTER_CHANNEL_EVENT]: (data: any) => {
      if (!data || !this.isCallUserData(data)) {
        console.error('Invalid enter channel data:', data);
        return;
      }

      const userStore = useUserStore.getState();

      // 사용자 추가/업데이트
      const existingUser = userStore.users.find(u => u.user_id === data.user_id);
      if (!existingUser) {
        userStore.addUser(data);
      } else {
        userStore.updateUser(data.user_id, data);
      }

      if (data.user_id === useAuthStore.getState().user?.email) {
        useUserStore.getState().setCurrentUser(data);
        console.log('Entered channel [', data.channel_id, '] :', useAuthStore.getState().user?.email);
      }
    },

    [OP_CODES.LEAVE_CHANNEL_EVENT]: (data: ChannelEventData) => {
      if (!data?.user_id) return;

      const userStore = useUserStore.getState();
      const currentUser = userStore.currentUser;

      if (currentUser?.user_id === data.user_id) {
        userStore.setCurrentUser(null);
        WebRTCConnection.getInstance().closeAllConnections();
      } else {
        WebRTCConnection.getInstance().closePeerConnection(data.user_id);
        userStore.removeUser(data.user_id);
      }
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
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('Received message:', message);

      if (message.op === OP_CODES.ERROR && this.isErrorData(message.data)) {
        this.handleErrorMessage(message.data);
        return;
      }

      const handler = this.messageHandlers[message.op];
      if (handler) {
        // data 프로퍼티가 있는 경우 data.data를 전달
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

    switch (error.code) {
      case ERROR_CODES.UNAUTHORIZED_ACCESS_TOKEN:
      case ERROR_CODES.UNAUTHORIZED_USER:
        this.disconnect();
        break;
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

  async joinChannel(channelId: string, type: MediaChannelType) {
    if (!this.isConnected()) {
      console.error('WebSocket is not connected');
      return false;
    }

    return new Promise((resolve) => {
      let isResolved = false;
      const timeoutDuration = 5000;

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('Channel join timed out');
          resolve(false);
        }
      }, timeoutDuration);

      // const handleEnterChannel = (data: any) => {
      //   console.log('handleEnterChannel called with:', data);  // 추가
      //
      //   if (!this.isCallUserData(data)) {
      //     console.log('isCallUserData check failed:', {  // 추가
      //       hasData: !!data,
      //       userId: data?.user_id,
      //       userIdType: typeof data?.user_id,
      //       username: data?.username,
      //       usernameType: typeof data?.username
      //     });
      //     console.error('Invalid user data received:', data);
      //     return;
      //   }
      //
      //   console.log('Comparing channel IDs:', {  // 추가
      //     received: String(data.channel_id),
      //     expected: String(channelId)
      //   });
      //
      //   if (String(data.channel_id) === String(channelId)) {
      //     console.log('Channel join successful:', data);
      //
      //     const userStore = useUserStore.getState();
      //     userStore.setCurrentUser(data);
      //
      //     const existingUser = userStore.users.find(u => u.user_id === data.user_id);
      //     if (!existingUser) {
      //       userStore.addUser(data);
      //     } else {
      //       userStore.updateUser(data.user_id, data);
      //     }
      //
      //     isResolved = true;
      //     clearTimeout(timeoutId);
      //     resolve(true);
      //   }
      // };

      // console.log('Setting up ENTER_CHANNEL_EVENT handler');  // 추가
      // const originalHandler = this.messageHandlers[OP_CODES.ENTER_CHANNEL_EVENT];
      // this.messageHandlers[OP_CODES.ENTER_CHANNEL_EVENT] = (data: any) => {
      //   console.log('ENTER_CHANNEL_EVENT received:', data);  // 추가
      //   handleEnterChannel(data);
      //   if (originalHandler && !isResolved) {
      //     originalHandler(data);
      //   }
      // };

      isResolved = true;
      clearTimeout(timeoutId);
      resolve(true);

      this.sendOp(OP_CODES.ENTER_CHANNEL, {
        server_id: this.currentServerId,
        channel_id: channelId,
        channel_type: type,
      });
      return true;
    });
  }

  leaveChannel() {
    const userStore = useUserStore.getState();
    const currentUser = userStore.currentUser;

    if (!currentUser?.channel_id) return;

    this.sendOp(OP_CODES.LEAVE_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: currentUser.channel_id,
      channel_type: currentUser.channel_type,
    });

    WebRTCConnection.getInstance().closeAllConnections();
    userStore.resetState();
  }

  updateState(update: VoiceStateUpdate) {
    const userStore = useUserStore.getState();
    const currentUser = userStore.currentUser;

    if (!currentUser?.channel_id) return;

    this.sendOp(OP_CODES.UPDATE_STATE, {
      server_id: this.currentServerId,
      channel_id: currentUser.channel_id,
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