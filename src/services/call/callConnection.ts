import {
  CallServerMessage,
  CallState,
  CallUserData,
  LeaveChannelData,
  MediaChannelType,
  VoiceStateUpdate,
} from './types';
import { CALL_API, OP_CODES, RECONNECT_DELAY } from './constants';
import { apiClient } from '@/api/apiClient';

interface CallServerResponse {
  url: string;
}

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
    console.log('🌐 Attempting to connect to call server...', { serverId: this.currentServerId });

    try {
      const response = await apiClient.client.get<CallServerResponse>(CALL_API.GET_WEBSOCKET_URL);
      console.log('API Response:', response);
      if (!response.data.url) throw new Error('WebSocket URL not received');

      this.ws = new WebSocket(response.data.url);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('❌ Failed to connect to call server:', error);
      this.scheduleReconnect();
    }
  }

  private setupWebSocketHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('🌐 WebSocket connected successfully');
      this.updateConnectionStatus('CONNECTED');
      this.sendOp(OP_CODES.INITIAL, { token: this.accessToken });
    };

    this.ws.onmessage = this.handleMessage;
    this.ws.onclose = this.handleClose;
    this.ws.onerror = this.handleError;
  }

  private isCallUserData(data: any): data is CallUserData {
    return 'user_id' in data && 'username' in data;
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message: CallServerMessage = JSON.parse(event.data);
      console.log('📨 Received message:', message);

      switch (message.op) {
        case OP_CODES.INITIAL_ACK:
          if (message.data && 'heartbeat_interval' in message.data) {
            console.log('💓 Setting up heartbeat with interval:', message.data.heartbeat_interval);
            this.setupHeartbeat(message.data.heartbeat_interval);
            this.sendOp(OP_CODES.HEARTBEAT);
            this.sendServerIdentification();
          }
          break;

        case OP_CODES.HEARTBEAT_ACK:
          console.log('💓 Heartbeat acknowledged');
          break;

        case OP_CODES.IDENTIFY_ACK:
          console.log('🎯 Server identification acknowledged');
          if (message.data && this.isCallUserData(message.data)) {
            console.log('🔄 Updating users with identify data');
            this.updateUsers([message.data]);
          }
          break;

        case OP_CODES.JOIN_CHANNEL_ACK:
          console.log('🎯 Channel join acknowledged');
          if (message.data && this.isCallUserData(message.data)) {
            const userData = message.data;
            this.updateCurrentUser(userData);

            const updatedUsers = [...this.state.users];
            if (!updatedUsers.some(u => u.user_id === userData.user_id)) {
              updatedUsers.push(userData);
            }
            this.updateUsers(updatedUsers);
          }
          break;

        case OP_CODES.LEAVE_CHANNEL_ACK:
          console.log('👋 Channel leave acknowledged');
          if (message.data && 'user_id' in message.data) {
            const leavingUserId = message.data.user_id;

            // 현재 유저가 떠나는 경우
            if (this.state.currentUser?.user_id === leavingUserId) {
              this.state.currentUser = null;  // 현재 유저만 null로
            }

            // users 배열에서 해당 user_id만 제거
            this.state.users = this.state.users.filter(
              user => user.user_id !== leavingUserId
            );

            this.notifyStateUpdate();
          }
          break;

        case OP_CODES.STATE_UPDATE_ACK:
          console.log('🔄 State update acknowledged');
          if (message.data && this.isCallUserData(message.data)) {
            const updatedUser = message.data;

            // 현재 유저인 경우
            if (this.state.currentUser?.user_id === updatedUser.user_id) {
              // 기존 상태를 유지하면서 업데이트
              this.updateCurrentUser({
                ...this.state.currentUser,
                ...updatedUser
              });
            }

            // users 배열도 기존 상태를 유지하면서 업데이트
            this.state.users = this.state.users.map(user =>
              user.user_id === updatedUser.user_id
                ? { ...user, ...updatedUser }
                : user
            );
            this.notifyStateUpdate();
          }
          break;

        default:
          console.warn('⚠️ Unhandled message type:', message);
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
    }
  };

  private setupHeartbeat(interval: number | undefined) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 주기적인 heartbeat 전송 설정
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('💓 Sending heartbeat');
        this.sendOp(OP_CODES.HEARTBEAT);
      } else {
        console.warn('⚠️ WebSocket is not open, skipping heartbeat');
      }
    }, interval);

    // interval이 변경될 때마다 현재 상태를 로그로 출력
    console.log('💓 Heartbeat interval set to', interval, 'ms');
  }

  private handleClose = (event: CloseEvent) => {
    console.log('🔌 WebSocket closed:', event);
    this.updateConnectionStatus('CLOSED');
    this.cleanup();
    this.scheduleReconnect();
  };

  private handleError = (error: Event) => {
    console.error('❌ WebSocket error:', error);
    this.updateConnectionStatus('ERROR');
    this.cleanup();
  };

  private sendOp(op: number, data?: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ op, data });
      console.log('📤 Sending message:', message);
      this.ws.send(message);
    } else {
      console.warn('⚠️ Attempted to send message while WebSocket is not open');
    }
  }

  private sendServerIdentification() {
    console.log('🎯 Sending server identification:', this.currentServerId);
    this.sendOp(OP_CODES.IDENTIFY, {
      server_id: this.currentServerId,
    });
  }

  joinChannel(channelId: string, channelType: MediaChannelType = 'VOICE') {
    console.log('🎯 Joining channel:', channelId);
    this.currentChannelId = channelId;
    this.sendOp(OP_CODES.JOIN_CHANNEL, {
      server_id: this.currentServerId,
      channel_id: channelId,
      channel_type: channelType,
    });
  }

  private isLeaveChannelData(data: any): data is LeaveChannelData {
    return 'user_id' in data && 'channel_id' in data && !('username' in data);
  }

  leaveChannel() {
    if (this.currentChannelId) {
      console.log('👋 Leaving channel:', this.currentChannelId);
      this.sendOp(OP_CODES.LEAVE_CHANNEL, {
        server_id: this.currentServerId,
        channel_id: this.currentChannelId,
        channel_type: 'VOICE',
      });
      this.currentChannelId = null;
    }
  }

  updateState(state: VoiceStateUpdate) {
    if (this.currentChannelId && this.state.currentUser) {
      console.log('🔄 Updating state:', state);
      // 현재 상태를 보존하면서 새로운 상태만 업데이트
      const updatedState = {
        muted: this.state.currentUser.muted,
        deafened: this.state.currentUser.deafened,
        speaking: this.state.currentUser.speaking,
        camera_on: this.state.currentUser.camera_on,
        screen_sharing: this.state.currentUser.screen_sharing,
        ...state  // 새로운 상태로 덮어쓰기
      };

      this.sendOp(OP_CODES.STATE_UPDATE, {
        server_id: this.currentServerId,
        channel_id: this.currentChannelId,
        ...updatedState
      });
    }
  }

  private updateUsers(users: CallUserData[]) {
    this.state.users = users;
    this.notifyStateUpdate();
  }

  private updateCurrentUser(user: CallUserData | null) {
    this.state.currentUser = user;
    this.notifyStateUpdate();
  }

  private updateConnectionStatus(status: string) {
    this.state.connectionStatus = status;
    this.notifyStateUpdate();
  }

  private notifyStateUpdate() {
    this.onStateUpdate({ ...this.state });
  }

  private scheduleReconnect() {
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        this.connect(this.currentServerId);
      }, RECONNECT_DELAY);
    }
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

  disconnect() {
    console.log('📴 Disconnecting from call server');
    this.cleanup();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  getConnectionStatus() {
    if (!this.ws) return 'DISCONNECTED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}