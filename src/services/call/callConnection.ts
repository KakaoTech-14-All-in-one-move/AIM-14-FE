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
            console.log('🔍 Join channel data:', message.data);
            const userData = message.data;

            // 내가 입장한 경우 currentUser 업데이트
            if (!this.state.currentUser) {
              console.log('👤 Setting current user:', userData);
              this.updateCurrentUser(userData);
            }

            // users 배열에 추가 또는 업데이트
            const existingUserIndex = this.state.users.findIndex(u => u.user_id === userData.user_id);
            if (existingUserIndex === -1) {
              console.log('➕ Adding new user to users list:', userData);
              this.updateUsers([...this.state.users, userData]);
            } else {
              console.log('🔄 Updating existing user in users list:', userData);
              const updatedUsers = [...this.state.users];
              updatedUsers[existingUserIndex] = userData;
              this.updateUsers(updatedUsers);
            }

            console.log('📊 Current state after join:', {
              currentUser: this.state.currentUser,
              users: this.state.users
            });
          } else {
            console.warn('⚠️ Received JOIN_CHANNEL_ACK without valid user data:', message.data);
          }
          break;

        case OP_CODES.LEAVE_CHANNEL_ACK:
          console.log('👋 Channel leave acknowledged');
          console.log('🔍 Raw leave channel response:', message);

          if (!message.data) {
            console.warn('⚠️ No data in leave channel response');
            return;
          }

          if ('user_id' in message.data) {
            const leavingUserId = message.data.user_id;
            console.log('🚪 User leaving channel:', {
              leavingUserId,
              currentUserId: this.state.currentUser?.user_id,
              currentUsers: this.state.users.map(u => ({ id: u.user_id, name: u.username }))
            });

            // users 배열에서 해당 유저 제거
            const updatedUsers = this.state.users.filter(user => user.user_id !== leavingUserId);
            console.log('📊 Users after filtering:', updatedUsers.map(u => ({ id: u.user_id, name: u.username })));

            // 퇴장하는 유저가 현재 유저인 경우
            if (this.state.currentUser?.user_id === leavingUserId) {
              console.log('🔄 Current user is leaving - resetting current user');
              this.updateCurrentUser(null);
            }

            // users 배열 업데이트
            this.updateUsers(updatedUsers);

            console.log('📊 Final state after leave:', {
              currentUser: this.state.currentUser,
              remainingUsers: this.state.users.map(u => ({ id: u.user_id, name: u.username }))
            });
          } else {
            console.warn('⚠️ Invalid leave channel data format:', message.data);
          }
          break;

        case OP_CODES.STATE_UPDATE_ACK:
          if (message.data && this.isCallUserData(message.data)) {
            const updatedUser = message.data;

            // 내 상태가 변경된 경우
            if (this.state.currentUser?.user_id === updatedUser.user_id) {
              this.updateCurrentUser({
                ...this.state.currentUser,
                muted: updatedUser.muted !== undefined ? updatedUser.muted : this.state.currentUser.muted,
                deafened: updatedUser.deafened !== undefined ? updatedUser.deafened : this.state.currentUser.deafened,
                speaking: updatedUser.speaking !== undefined ? updatedUser.speaking : this.state.currentUser.speaking,
                camera_on: updatedUser.camera_on !== undefined ? updatedUser.camera_on : this.state.currentUser.camera_on,
                screen_sharing: updatedUser.screen_sharing !== undefined ? updatedUser.screen_sharing : this.state.currentUser.screen_sharing
              });
            }

            // users 배열에서 해당 유저 업데이트
            this.updateUsers(this.state.users.map(user =>
              user.user_id === updatedUser.user_id
                ? {
                  ...user,
                  muted: updatedUser.muted !== undefined ? updatedUser.muted : user.muted,
                  deafened: updatedUser.deafened !== undefined ? updatedUser.deafened : user.deafened,
                  speaking: updatedUser.speaking !== undefined ? updatedUser.speaking : user.speaking,
                  camera_on: updatedUser.camera_on !== undefined ? updatedUser.camera_on : user.camera_on,
                  screen_sharing: updatedUser.screen_sharing !== undefined ? updatedUser.screen_sharing : user.screen_sharing
                }
                : user
            ));
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

      // 현재 유저의 현재 상태를 기반으로 새로운 상태만 업데이트
      const currentState = {
        muted: this.state.currentUser.muted,
        deafened: this.state.currentUser.deafened,
        speaking: this.state.currentUser.speaking,
        camera_on: this.state.currentUser.camera_on,
        screen_sharing: this.state.currentUser.screen_sharing
      };

      // 변경하려는 상태만 업데이트하여 기존 상태와 병합
      const updatedState = {
        ...currentState,  // 기존 상태를 기반으로
        ...state         // 새로운 상태만 덮어쓰기
      };

      // 모든 상태값을 포함하여 전송
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