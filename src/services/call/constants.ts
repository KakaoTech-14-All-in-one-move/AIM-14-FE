export const CALL_API = {
  GET_WEBSOCKET_URL: '/api/v1/call',
  DEFAULT_SERVER_ID: '12345',
  DEFAULT_CHANNEL_ID: '5143992e-9dcd-45fe-bcc7-e337417b0cfe'
};

export const OP_CODES = {
  INITIAL: 0,
  HEARTBEAT: 1,
  HEARTBEAT_ACK: 2,
  IDENTIFY: 2,
  IDENTIFY_ACK: 3,
  JOIN_CHANNEL: 3,
  JOIN_CHANNEL_ACK: 4,
  LEAVE_CHANNEL: 4,
  LEAVE_CHANNEL_ACK: 5,
  STATE_UPDATE: 5,
  STATE_UPDATE_ACK: 6
} as const;

export const RECONNECT_DELAY = 5000;

export const DEFAULT_VOICE_STATE = {
  muted: false,
  deafened: false,
  speaking: false,
  cameraOn: false,
  screenSharing: false
};