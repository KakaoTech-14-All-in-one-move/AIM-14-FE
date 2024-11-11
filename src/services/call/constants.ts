// services/call/constants.ts
import { ChannelMapping } from './types.ts';

export const CALL_API = {
  GET_WEBSOCKET_URL: '/api/v1/call',
  DEFAULT_SERVER_ID: '12345',
  DEFAULT_CHANNEL_ID: '5143992e-9dcd-45fe-bcc7-e337417b0cfe'
};

// 기존 음성 채널 매핑은 그대로 유지
export const TEMP_CHANNEL_MAPPING: ChannelMapping = {
  serverId: '12345',
  channelName: '일반',
  channelId: '5143992e-9dcd-45fe-bcc7-e337417b0cfe',
  channelType: 'VOICE'
};

// 비디오 채널 매핑 추가
export const VIDEO_CHANNEL_MAPPING: ChannelMapping = {
  serverId: '12345',
  channelName: '일반',
  channelId: '6143992e-9dcd-45fe-bcc7-e337417b0cfe',
  channelType: 'VIDEO'
};

export const OP_CODES = {
  INITIAL: 0,
  INITIAL_ACK: 10,
  HEARTBEAT: 1,
  HEARTBEAT_ACK: 11,
  IDENTIFY: 2,
  IDENTIFY_ACK: 12,
  JOIN_CHANNEL: 3,
  JOIN_CHANNEL_ACK: 13,
  LEAVE_CHANNEL: 4,
  LEAVE_CHANNEL_ACK: 14,
  STATE_UPDATE: 5,
  STATE_UPDATE_ACK: 15
} as const;

export const RECONNECT_DELAY = 5000;