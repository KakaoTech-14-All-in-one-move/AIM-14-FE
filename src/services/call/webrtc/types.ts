export interface WebRTCState {
  isConnected: boolean;
  isPresenter: boolean;
  hasMicPermission: boolean;
  hasCameraPermission: boolean;
  currentAudioInputId: string | null;
  currentAudioOutputId: string | null;
  currentVideoInputId: string | null;
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

export interface MediaDeviceInfo {
  deviceId: string;
  groupId: string;
  kind: MediaDeviceKind;
  label: string;
}

export type MediaStreamConstraints = {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
};