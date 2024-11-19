import {
  CallServerMessage,
  CallState,
  CallUserData,
  LeaveChannelData,
  MediaChannelType,
  VoiceStateUpdate,
} from '@/services/call/types';
import { CALL_API, OP_CODES, RECONNECT_DELAY } from '@/services/call/constants';
import { apiClient } from '@/api/apiClient';
import { isEqual } from 'lodash';

interface CallServerResponse {
  url: string;
}


type MessageHandlerMap = {
  [K: number]: (data: any) => void;
  [OP_CODES.JOIN_CHANNEL_ACK]: (data: any) => void;
  [OP_CODES.LEAVE_CHANNEL_ACK]: (data: any) => void;
  [OP_CODES.STATE_UPDATE_ACK]: (data: any) => void;
  [OP_CODES.INITIAL_ACK]: (data: any) => void;
  [OP_CODES.IDENTIFY_ACK]: (data: any) => void;  // 추가
  [OP_CODES.HEARTBEAT_ACK]: () => void;
};

export class CallConnection {
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentServerId: string = CALL_API.DEFAULT_SERVER_ID;
  private currentChannelId: string | null = null;
  private onStateUpdate: (state: CallState) => void;
  private accessToken: string;
  private state: CallState = {
    users: [],
    currentUser: null,
    connectionStatus: 'DISCONNECTED',
  };

  constructor(onStateUpdate: (state: CallState) => void, accessToken: string) {
    this.onStateUpdate = onStateUpdate;
    this.accessToken = accessToken;
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

  public isInChannel(): boolean {
    return !!this.currentChannelId &&
      !!this.state.currentUser &&
      this.ws?.readyState === WebSocket.OPEN;
  }

  private handleOpen = () => {
    console.log('🌐 WebSocket connected');
    this.updateConnectionStatus('CONNECTED');
    this.sendOp(OP_CODES.INITIAL, { token: this.accessToken });
  };

  private messageHandlers: MessageHandlerMap = {
    [OP_CODES.JOIN_CHANNEL_ACK]: (data: any) => {
      console.log('JOIN_CHANNEL_ACK received:', data);  // 디버깅 로그 추가

      if (!data) {
        console.warn('No data in JOIN_CHANNEL_ACK');
        return;
      }

      // 단일 유저 데이터인 경우
      if (this.isCallUserData(data)) {
        this.updateUsers(prevUsers => {
          console.log('Updating users with single user data:', data);
          const existingUserIndex = prevUsers.findIndex(u => u.user_id === data.user_id);
          if (existingUserIndex === -1) {
            return [...prevUsers, data];
          } else {
            const updatedUsers = [...prevUsers];
            updatedUsers[existingUserIndex] = data;
            return updatedUsers;
          }
        });

        if (!this.state.currentUser) {
          this.updateCurrentUser(data);
        }
      }
      // 유저 배열인 경우
      else if (Array.isArray(data)) {
        console.log('Updating users with array data:', data);
        this.updateUsers(() => data.filter(this.isCallUserData));
      }
    },

    [OP_CODES.STATE_UPDATE_ACK]: (data: any) => {
      console.log('STATE_UPDATE_ACK received:', data);

      if (!this.isCallUserData(data)) {
        console.warn('Invalid user data in STATE_UPDATE_ACK:', data);
        return;
      }

      // 응답으로 받은 user_id를 기준으로 상태 업데이트
      const updatedUserId = data.user_id;

      this.updateUsers(prevUsers => {
        return prevUsers.map(user =>
          user.user_id === updatedUserId
            ? {
              ...user,
              ...data,
              // 명시적으로 각 상태 업데이트
              muted: data.muted ?? user.muted,
              deafened: data.deafened ?? user.deafened,
              speaking: data.speaking ?? user.speaking,
              camera_on: data.camera_on ?? user.camera_on,
              screen_sharing: data.screen_sharing ?? user.screen_sharing
            }
            : user
        );
      });

      // 현재 사용자의 상태도 업데이트
      if (this.state.currentUser?.user_id === updatedUserId) {
        this.updateCurrentUser({
          ...this.state.currentUser,
          ...data,
          muted: data.muted ?? this.state.currentUser.muted,
          deafened: data.deafened ?? this.state.currentUser.deafened,
          speaking: data.speaking ?? this.state.currentUser.speaking,
          camera_on: data.camera_on ?? this.state.currentUser.camera_on,
          screen_sharing: data.screen_sharing ?? this.state.currentUser.screen_sharing
        });
      }

      console.log('State updated for user:', {
        userId: updatedUserId,
        newState: data,
        allUsers: this.state.users,
        currentUser: this.state.currentUser
      });
    },

    [OP_CODES.LEAVE_CHANNEL_ACK]: (data: any) => {
      const leaveData = data as LeaveChannelData;
      if (!leaveData?.user_id) return;

      const leavingUserId = leaveData.user_id;
      console.log('👋 User leaving:', leavingUserId);

      this.updateUsers(prevUsers => {
        const updatedUsers = prevUsers.filter(user => user.user_id !== leavingUserId);
        console.log('Updated users after leave:', updatedUsers);
        return updatedUsers;
      });

      if (this.state.currentUser?.user_id === leavingUserId) {
        this.updateCurrentUser(null);
      }
    },

    [OP_CODES.INITIAL_ACK]: (data: any) => {
      console.log('INITIAL_ACK received:', data);
      if (data?.heartbeat_interval) {
        this.setupHeartbeat(data.heartbeat_interval);
        // INITIAL_ACK 이후 서버 식별 정보 전송
        this.sendServerIdentification();
      }
    },

    [OP_CODES.HEARTBEAT_ACK]: () => {
      console.log('💓 Heartbeat acknowledged');
    },

    [OP_CODES.IDENTIFY_ACK]: (data: any) => {
      console.log('IDENTIFY_ACK received:', data);
      if (data && this.isCallUserData(data)) {
        console.log('🔄 Updating users with identify data');
        this.updateUsers(() => [data]);

        // 처음 연결된 경우 currentUser 설정
        if (!this.state.currentUser) {
          this.updateCurrentUser(data);
        }
      }
    },

  };

  private sendServerIdentification() {
    console.log('🎯 Sending server identification:', this.currentServerId);
    this.sendOp(OP_CODES.IDENTIFY, {
      server_id: this.currentServerId,
    });
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message: CallServerMessage = JSON.parse(event.data);
      console.log('📨 Received:', message);

      const handler = this.messageHandlers[message.op];
      if (handler) {
        handler(message.data);
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
    }
  };

  private handleClose = (event: CloseEvent) => {
    console.log('🔌 WebSocket closed:', event);
    this.updateConnectionStatus('CLOSED');
    this.cleanup();
    this.scheduleReconnect();
  };

  private handleError = (error: Event) => {
    console.error('❌ WebSocket error:', error);
    this.handleConnectionError();
  };

// callConnection.ts (계속)

  private handleConnectionError() {
    console.error('Connection error occurred');
    this.updateConnectionStatus('ERROR');
    this.cleanup();
    this.scheduleReconnect();
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

  private sendOp(op: number, data?: any) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not open');
      return;
    }

    const message = JSON.stringify({ op, data });
    this.ws.send(message);
    console.log('📤 Sent:', { op, data });
  }

  private updateCurrentUser = (user: CallUserData | null) => {
    if (!isEqual(this.state.currentUser, user)) {
      this.state.currentUser = user;
      this.notifyStateUpdate();
    }
  };

  private updateConnectionStatus = (status: string) => {
    if (this.state.connectionStatus !== status) {
      this.state.connectionStatus = status;
      this.notifyStateUpdate();
    }
  };

  private updateUsers = (
    updater: (prev: CallUserData[]) => CallUserData[],
  ) => {
    const updatedUsers = updater(this.state.users);
    console.log('Updating users:', {
      previous: this.state.users,
      updated: updatedUsers,
    });

    this.state.users = updatedUsers;
    this.notifyStateUpdate();
  };

  private notifyStateUpdate = () => {
    const newState = { ...this.state };
    console.log('Notifying state update:', newState);
    this.onStateUpdate(newState);
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

  // Public Methods
  joinChannel(channelId: string, channelType: MediaChannelType = 'VOICE') {
    console.log('🎯 Joining channel:', channelId);
    this.currentChannelId = channelId;
    this.sendOp(OP_CODES.JOIN_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: channelId,
      channel_type: channelType,
    });
  }

  leaveChannel() {
    if (!this.currentChannelId) return;

    console.log('👋 Leaving channel:', this.currentChannelId);
    this.sendOp(OP_CODES.LEAVE_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: this.currentChannelId,
      channel_type: 'VOICE',
    });
    this.currentChannelId = null;
  }

  updateState(state: VoiceStateUpdate) {
    if (!this.isInChannel()) {
      console.warn('⚠️ Cannot update state:', {
        hasChannel: !!this.currentChannelId,
        hasUser: !!this.state.currentUser,
        connectionState: this.ws?.readyState
      });
      return;
    }

    const currentState = {
      muted: this.state.currentUser!.muted,
      deafened: this.state.currentUser!.deafened,
      speaking: this.state.currentUser!.speaking,
      camera_on: this.state.currentUser!.camera_on,
      screen_sharing: this.state.currentUser!.screen_sharing,
    };

    const updatedState = { ...currentState, ...state };

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