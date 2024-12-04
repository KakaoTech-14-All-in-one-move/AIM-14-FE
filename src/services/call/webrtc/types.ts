export interface WebRTCState {
  isConnected: boolean;
  isInChannel: boolean;
  hasMicPermission: boolean;
  hasCameraPermission: boolean;
  currentAudioInputId: string | null;
  currentAudioOutputId: string | null;
  currentVideoInputId: string | null;
}

export interface WebRTCEvents {
  onTrack?: (stream: MediaStream, userId: string) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCConfig {
  iceServers: IceServerConfig[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
}

export interface WebRTCConnectionOptions {
  configuration?: WebRTCConfig;
}

export interface MediaDevice {
  deviceId: string;
  label: string;
}

export interface MediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

export interface PeerConnection {
  connection: RTCPeerConnection;
  userId: string;
}