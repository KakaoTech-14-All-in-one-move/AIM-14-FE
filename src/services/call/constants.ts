export const CALL_API = {
  GET_WEBSOCKET_URL: '/api/v1/call',
  DEFAULT_SERVER_ID: '1',
  DEFAULT_VOICE_CHANNEL_ID: '1',
  DEFAULT_VIDEO_CHANNEL_ID: '2',
};

export const OP_CODES = {
  // Client -> Server
  INIT: 0,
  HEARTBEAT: 1,
  SERVER: 2,
  ENTER_CHANNEL: 3,
  LEAVE_CHANNEL: 4,
  UPDATE_STATE: 5,
  ON_ICE_CANDIDATE: 6,
  RECEIVE_VIDEO: 7,
  CANCEL_VIDEO: 8,

  // Server -> Client
  ERROR: -1,
  INIT_ACK: 10,
  HEARTBEAT_ACK: 11,
  SERVER_ACK: 12,
  ENTER_CHANNEL_EVENT: 13,
  LEAVE_CHANNEL_EVENT: 14,
  UPDATE_STATE_EVENT: 15,
  ICE_CANDIDATE: 16,
  RECEIVE_VIDEO_ANSWER: 17,
  CANCEL_VIDEO_ANSWER: 18,
} as const;

export const ERROR_CODES = {
  INTERNAL_SERVER_ERROR: 1000,
  UNAUTHORIZED_ACCESS_TOKEN: 1001,
  UNAUTHORIZED_USER: 1002,
  INVALID_SERVER_ID: 1011,
  INVALID_CHANNEL_ID: 1012,
  INVALID_REQUEST_OPERATION: 1013,
  DUPLICATE_SERVER_DESTINATION: 1021,
  DUPLICATE_CHANNEL_ENTRY: 1022,
  DUPLICATE_CHANNEL_EXIT: 1023,
  WRONG_ACCESS_INACTIVE_USER: 1031,
  WRONG_ACCESS_INACTIVE_SERVER: 1032,
  WRONG_ACCESS_INACTIVE_CHANNEL: 1033,
} as const;

export const RECONNECT_DELAY = 5000;

export const ICE_SERVER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:13.124.102.218:3478',
      username: 'aim14',
      credential: 'aim14',
    },
  ],
};

export const OFFER_OPTION = {
  VOICE_CHANNEL: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
    voiceActivityDetection: true,
    iceRestart: true,
  },
  VIDEO_CHANNEL: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
    voiceActivityDetection: true,
    iceRestart: true,
  }
} as const;