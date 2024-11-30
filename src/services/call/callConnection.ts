import {
  CallServerMessage,
  CallState,
  CallUserData,
  ErrorData,
  LeaveChannelData,
  MediaChannelType,
  VoiceStateUpdate,
} from '@/services/call/types';
import { CALL_API, ERROR_CODES, OP_CODES, RECONNECT_DELAY } from '@/services/call/constants';
import { apiClient } from '@/api/apiClient';
import { isEqual } from 'lodash';
import { WebRTCConnection } from '@/services/call/webrtc/WebRTCConnection.ts';

interface CallServerResponse {
  url: string;
}

type MessageHandlerMap = {
  [K: number]: (data: any) => void;
  [OP_CODES.JOIN_CHANNEL_ACK]: (data: any) => void;
  [OP_CODES.LEAVE_CHANNEL_ACK]: (data: any) => void;
  [OP_CODES.STATE_UPDATE_ACK]: (data: any) => void;
  [OP_CODES.INITIAL_ACK]: (data: any) => void;
  [OP_CODES.IDENTIFY_ACK]: (data: any) => void;
  [OP_CODES.HEARTBEAT_ACK]: () => void;
  [OP_CODES.PRESENTER_ACK]: (data: any) => void;
  [OP_CODES.VIEWER_ACK]: (data: any) => void
  [OP_CODES.ICE_CANDIDATE_ACK]: (data: any) => void;
  [OP_CODES.STOP_ACK]: () => void;
};

export class CallConnection {
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentServerId: string = CALL_API.DEFAULT_SERVER_ID;
  private currentChannelType: MediaChannelType = 'VOICE';
  currentChannelId: string | null = null;
  private readonly onStateUpdate: (state: CallState) => void;
  private readonly accessToken: string;
  private lastKnownUser: CallUserData | null = null;
  readonly state = new Proxy<CallState>(
    {
      users: [],
      currentUser: null,
      connectionStatus: 'DISCONNECTED',
    },
    {
      set: (target, property: keyof CallState, value) => {
        console.log(`[State Change] Property: ${String(property)}`);
        console.log('[State Change] From:', target[property]);
        console.log('[State Change] To:', value);

        // 값이 동일한 경우 불필요한 업데이트 방지
        if (isEqual(target[property], value)) {
          return true;
        }

        // 깊은 복사를 통해 객체 참조 문제 방지
        if (typeof value === 'object' && value !== null) {
          (target[property] as any) = structuredClone(value);
        } else {
          (target[property] as any) = value;
        }

        return true;
      },
    },
  );

  private setupUsersProxy() {
    this.state.users = new Proxy<CallUserData[]>([], {
      set: (target: CallUserData[], property: string | symbol, value) => {
        console.log('[Users Change] Index:', String(property));
        console.log('[Users Change] Value:', value);
        console.log('[Users Change] Stack:', new Error().stack);

        // property가 숫자 인덱스인 경우만 처리
        if (!isNaN(Number(property))) {
          target[Number(property)] = value;
        } else {
          // 숫자가 아닌 property의 경우 (예: length)
          (target as any)[property] = value;
        }

        return true;
      },
    });
  }

  constructor(onStateUpdate: (state: CallState) => void, accessToken: string) {
    this.onStateUpdate = onStateUpdate;
    this.accessToken = accessToken;
    this.setupUsersProxy();
  }

  private updateCurrentUser = (user: CallUserData | null) => {
    if (user) {
      this.lastKnownUser = user;
    }

    if (!isEqual(this.state.currentUser, user)) {
      this.state.currentUser = user || this.lastKnownUser;
      this.notifyStateUpdate();
    }
  };

  private notifyStateUpdate = () => {
    const clonedState = {
      users: [...this.state.users],
      currentUser: this.state.currentUser ? { ...this.state.currentUser } : null,
      connectionStatus: this.state.connectionStatus,
    };
    this.onStateUpdate(clonedState);
  };

  async sendPresenterOffer(sdpOffer: string) {
    const currentState = {
      users: [...this.state.users],  // 깊은 복사로 변경
      currentUser: this.state.currentUser ? { ...this.state.currentUser } : null,
    };

    this.sendOp(OP_CODES.PRESENTER, {
      channel_id: this.currentChannelId,
      sdp_offer: sdpOffer,
    });

    // 상태 복원이 필요한 경우에만 실행
    if (this.state.users.length === 0 && currentState.users.length > 0) {
      this.updateUsers(() => currentState.users);
    }
    if (!this.state.currentUser && currentState.currentUser) {
      this.updateCurrentUser(currentState.currentUser);
    }
  }

  async connect(serverId: string = CALL_API.DEFAULT_SERVER_ID) {
    this.currentServerId = serverId;
    console.log('🌐 Connecting to call server...', { serverId: this.currentServerId });

    try {
      const response = await apiClient.client.get<CallServerResponse>(CALL_API.GET_WEBSOCKET_URL);
      if (!response.data.url) throw new Error('WebSocket URL not received');

      this.ws = new WebSocket(response.data.url);
      this.setupWebSocketHandlers();
      this.updateConnectionStatus('CONNECTING');
    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.handleConnectionError();
    }
  }

  private setupWebSocketHandlers() {
    if (!this.ws) return;

    this.ws.onopen = this.handleOpen;
    this.ws.onmessage = this.handleMessage;
    this.ws.onclose = this.handleClose;
    this.ws.onerror = this.handleError;
  }

  isInChannel(): boolean {
    const isChannelValid = !!this.currentChannelId;
    const isUserValid = !!this.state.currentUser;
    const isWebSocketOpen = this.ws?.readyState === WebSocket.OPEN;

    console.log('Channel status check:', {
      channelId: this.currentChannelId,
      currentUser: this.state.currentUser,
      wsState: this.ws?.readyState,
      isChannelValid,
      isUserValid,
      isWebSocketOpen
    });

    return isChannelValid && isUserValid && isWebSocketOpen;
  }

  private handleConnectionError() {
    console.error('Connection error occurred');
    this.updateConnectionStatus('ERROR');
    this.cleanup();
    this.scheduleReconnect();
  }

  async sendViewerOffer(sdpOffer: string) {
    console.log('Sending viewer offer:', sdpOffer);
    this.sendOp(OP_CODES.VIEWER, {
      channel_id: this.currentChannelId,
      sdp_offer: sdpOffer,
    });
  }

  async sendIceCandidate(candidate: RTCIceCandidate) {
    this.sendOp(OP_CODES.ICE_CANDIDATE, {
      channel_id: this.currentChannelId,
      candidate: candidate.toJSON(),
      sdp_mid: candidate.sdpMid,
      sdp_m_line_index: candidate.sdpMLineIndex,
    });
  }

  private messageHandlers: MessageHandlerMap = {
    [OP_CODES.JOIN_CHANNEL_ACK]: (data: any) => {
      console.log('JOIN_CHANNEL_ACK received:', data);

      if (!data) {
        console.warn('No data in JOIN_CHANNEL_ACK');
        return;
      }

      if (this.isCallUserData(data)) {
        console.log('Valid CallUserData received:', data);

        this.updateUsers(prevUsers => {
          console.log('Previous users:', prevUsers);
          const existingUserIndex = prevUsers.findIndex(u => u.user_id === data.user_id);
          const updatedUsers = existingUserIndex === -1
            ? [...prevUsers, data]
            : prevUsers.map((u, i) => i === existingUserIndex ? data : u);
          console.log('Updated users:', updatedUsers);
          return updatedUsers;
        });

        if (!this.state.currentUser) {
          console.log('Setting currentUser:', data);
          this.updateCurrentUser(data);
        }
      } else {
        console.warn('Invalid CallUserData format:', data);
      }
    },

    [OP_CODES.LEAVE_CHANNEL_ACK]: (data: any) => {
      const leaveData = data as LeaveChannelData;
      if (!leaveData?.user_id) return;

      this.updateUsers(prevUsers =>
        prevUsers.filter(user => user.user_id !== leaveData.user_id),
      );

      if (this.state.currentUser?.user_id === leaveData.user_id) {
        this.updateCurrentUser(null);
      }
    },

    [OP_CODES.STATE_UPDATE_ACK]: (data: any) => {
      if (!this.isCallUserData(data)) return;
      console.log('사용자 상태 업데이트 :', data);

      const updatedUserId = data.user_id;
      this.updateUsers(prevUsers =>
        prevUsers.map(user => {
          if (user.user_id === updatedUserId) {
            // Preserve the existing screen_sharing state
            return {
              ...user,
              ...data,
              screen_sharing: user.screen_sharing,
            };
          }
          return user;
        }),
      );

      if (this.state.currentUser?.user_id === updatedUserId) {
        this.updateCurrentUser({
          ...this.state.currentUser,
          ...data,
          screen_sharing: this.state.currentUser.screen_sharing,
        });
      }
    },

    [OP_CODES.INITIAL_ACK]: (data: any) => {
      if (data?.heartbeat_interval) {
        this.setupHeartbeat(data.heartbeat_interval);
        this.sendServerIdentification();
      }
    },

    [OP_CODES.IDENTIFY_ACK]: (data: any) => {
      if (data && this.isCallUserData(data)) {
        this.updateUsers(() => [data]);
        if (!this.state.currentUser) {
          this.updateCurrentUser(data);
        }
      }
    },

    [OP_CODES.HEARTBEAT_ACK]: () => {
    },

    [OP_CODES.STOP_ACK]: () => {
    },

    [OP_CODES.PRESENTER_ACK]: (data: any) => {
      console.log('Received presenter answer:', data);
      if (data?.sdp_answer) {
        const webrtc = WebRTCConnection.getInstance();
        webrtc.processSdpAnswer(data.sdp_answer);
      }
    },

    [OP_CODES.VIEWER_ACK]: (data: any) => {
      console.log('Received viewer answer:', data);
      if (data?.sdp_answer) {
        const webrtc = WebRTCConnection.getInstance();
        webrtc.processSdpAnswer(data.sdp_answer);
      }
    },

    [OP_CODES.ICE_CANDIDATE_ACK]: (data: any) => {
      if (data?.candidate) {
        const webrtc = WebRTCConnection.getInstance();
        webrtc.addIceCandidate(data.candidate);
      }
    },
  };


  private handleMessage = (event: MessageEvent) => {
    const getErrorName = (code: number): string => {
      const errorEntries = Object.entries(ERROR_CODES);
      const errorEntry = errorEntries.find(([_, value]) => value === code);
      return errorEntry ? errorEntry[0] : `UNKNOWN_ERROR_${code}`;
    };

    function isErrorData(data: any): data is ErrorData {
      return data && typeof data.code === 'number' && typeof data.message === 'string';
    }

    try {
      const message: CallServerMessage = JSON.parse(event.data);

      // Error message handling (-1 op code)
      if (message.op === -1 && message.data && isErrorData(message.data)) {
        const errorName = getErrorName(message.data.code);
        console.error('Error Message:', {
          name: errorName,
          code: message.data.code,
          message: message.data.message,
        });
        return;
      }

      const handler = this.messageHandlers[message.op];
      if (handler) {
        handler(message.data);
      } else {
        console.warn('No handler for message type:', message.op);
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  };

  private sendOp(op: number, data?: any) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open');
      return;
    }

    const message = JSON.stringify({ op, data });
    this.ws.send(message);
  }

  private handleOpen = () => {
    console.log('웹소켓 연결됨');
    this.updateConnectionStatus('CONNECTED');
    this.sendOp(OP_CODES.INITIAL, { token: this.accessToken });
  };

  private handleClose = () => {
    console.log('웹소켓 연결 종료됨');
    this.updateConnectionStatus('CLOSED');
    this.cleanup();
    this.scheduleReconnect();
  };

  private handleError = () => {
    console.error('웹소켓 에러 발생');
    this.handleConnectionError();
  };

  private sendServerIdentification() {
    console.log('🎯 Sending server identification:', this.currentServerId);
    this.sendOp(OP_CODES.IDENTIFY, {
      server_id: this.currentServerId,
    });
  }

  private setupHeartbeat(interval: number | undefined) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (!interval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendOp(OP_CODES.HEARTBEAT);
      }
    }, interval);

    console.log('💓 Heartbeat set:', interval, 'ms');
  }


  private updateConnectionStatus = (status: string) => {
    if (this.state.connectionStatus !== status) {
      this.state.connectionStatus = status;
      this.notifyStateUpdate();
    }
  };

  private updateUsers = (updater: (prev: CallUserData[]) => CallUserData[]) => {
    const prevUsers = [...this.state.users];
    const updatedUsers = updater(prevUsers);

    if (!isEqual(this.state.users, updatedUsers)) {
      this.state.users = updatedUsers;
      this.notifyStateUpdate();
    }
  };


  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      console.log('🔄 Attempting reconnection...');
      this.connect(this.currentServerId);
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

  private async waitForConnection(timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkConnection = () => {
        if (this.isConnected()) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          resolve(false);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  async joinChannel(channelId: string, channelType: MediaChannelType = 'VOICE'): Promise<boolean> {
    console.log('🎯 Joining channel:', channelId, '[', channelType, ']');

    // 연결 상태 확인
    const isConnected = await this.waitForConnection();
    if (!isConnected) {
      console.error('Failed to join channel: Connection timeout');
      return false;
    }

    // 이전 채널에서 나가기
    if (this.currentChannelId) {
      this.leaveChannel();
    }

    return new Promise((resolve) => {
      // JOIN_CHANNEL_ACK 핸들러를 위한 일회성 리스너
      const handleJoinAck = (data: any) => {
        if (this.isCallUserData(data)) {
          this.updateUsers(prevUsers => {
            const existingUserIndex = prevUsers.findIndex(u => u.user_id === data.user_id);
            return existingUserIndex === -1
              ? [...prevUsers, data]
              : prevUsers.map((u, i) => i === existingUserIndex ? data : u);
          });

          this.updateCurrentUser(data);
          resolve(true);
        }
      };

      // 기존 핸들러 임시 저장
      const originalHandler = this.messageHandlers[OP_CODES.JOIN_CHANNEL_ACK];

      // 임시 핸들러 설정
      this.messageHandlers[OP_CODES.JOIN_CHANNEL_ACK] = (data: any) => {
        handleJoinAck(data);
        this.messageHandlers[OP_CODES.JOIN_CHANNEL_ACK] = originalHandler; // 원래 핸들러 복구
      };

      this.currentChannelId = channelId;
      this.currentChannelType = channelType;

      // 채널 입장 요청
      this.sendOp(OP_CODES.JOIN_CHANNEL, {
        server_id: this.currentServerId,
        channel_id: channelId,
        channel_type: channelType,
      });

      // 타임아웃 설정
      setTimeout(() => {
        if (!this.state.currentUser) {
          this.messageHandlers[OP_CODES.JOIN_CHANNEL_ACK] = originalHandler;
          resolve(false);
        }
      }, 5000);
    });
  }

  leaveChannel() {
    if (!this.currentChannelId) return;

    console.log('👋 Leaving channel:', this.currentChannelId, '[', this.currentChannelType, ']');

    this.sendOp(OP_CODES.STOP);
    this.sendOp(OP_CODES.LEAVE_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: this.currentChannelId,
      channel_type: this.currentChannelType,
    });

    const webrtc = WebRTCConnection.getInstance();
    webrtc.dispose();

    this.currentChannelId = null;
    this.currentChannelType = 'VOICE';
  }

  updateState(state: VoiceStateUpdate) {
    if (!this.isInChannel()) {
      return;
    }

    const currentState = {
      muted: this.state.currentUser!.muted,
      deafened: this.state.currentUser!.deafened,
      speaking: this.state.currentUser!.speaking,
      camera_on: this.state.currentUser!.camera_on,
    };

    // Exclude screen_sharing from the state update sent to server
    const { screen_sharing, ...stateToUpdate } = state;
    const updatedState = { ...currentState, ...stateToUpdate };

    this.sendOp(OP_CODES.STATE_UPDATE, {
      server_id: this.currentServerId,
      channel_id: this.currentChannelId,
      ...updatedState,
    });
  }

  disconnect() {
    console.log('📴 Disconnecting from call server');
    this.cleanup();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private isCallUserData(data: any): data is CallUserData {
    return data &&
      typeof data.user_id === 'string' &&
      typeof data.username === 'string';
  }
}