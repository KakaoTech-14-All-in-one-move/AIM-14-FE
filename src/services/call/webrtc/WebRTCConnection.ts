import { ICE_SERVER_CONFIG } from '../constants';
import { WebRTCConnectionOptions, WebRTCEvents } from './types';
import { CallConnection } from '../socket/callConnection.ts';
import { useUserStore } from '@/stores/userStore';
import { useMediaStore } from '@/stores/mediaStore';

export class WebRTCConnection {
  private static instance: WebRTCConnection | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private events: WebRTCEvents | null = null;
  private audioContext: AudioContext | null = null;
  private mediaDevices: MediaDevices;

  private constructor() {
    this.mediaDevices = navigator.mediaDevices;
  }

  static getInstance(): WebRTCConnection {
    if (!WebRTCConnection.instance) {
      WebRTCConnection.instance = new WebRTCConnection();
    }
    return WebRTCConnection.instance;
  }

  initialize(events: WebRTCEvents) {
    this.events = events;
  }

  async createPeerConnection(userId: string, options?: WebRTCConnectionOptions) {
    try {
      const config = options?.configuration || ICE_SERVER_CONFIG;
      const peerConnection = new RTCPeerConnection(config);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          CallConnection.getInstance().sendIceCandidate(userId, event.candidate);
        }
      };

      peerConnection.ontrack = (event) => {
        this.events?.onTrack?.(event.streams[0], userId);
      };

      peerConnection.onconnectionstatechange = () => {
        this.events?.onConnectionStateChange?.(peerConnection.connectionState);
      };

      // Add local stream if exists
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      CallConnection.getInstance().sendVideoOffer(userId, offer.sdp!);

      this.peerConnections.set(userId, peerConnection);
      useUserStore.getState().setPeerConnection(userId, peerConnection);

    } catch (error) {
      console.error('Error creating peer connection:', error);
      this.events?.onError?.(error as Error);
    }
  }

  async handleVideoAnswer(userId: string, sdp: string) {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp,
      }));
    } catch (error) {
      console.error('Error handling video answer:', error);
      this.events?.onError?.(error as Error);
    }
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit) {
    const peerConnection = this.peerConnections.get(userId);
    if (!peerConnection) return;

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      this.events?.onError?.(error as Error);
    }
  }

  async initializeLocalStream(isVideo: boolean = false) {
    try {
      const constraints = {
        audio: true,
        video: isVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
      };

      this.localStream = await this.mediaDevices.getUserMedia(constraints);
      this.setupVoiceDetection();

      // Add tracks to all existing peer connections
      this.peerConnections.forEach(pc => {
        this.localStream!.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream!);
        });
      });

      return this.localStream;
    } catch (error) {
      console.error('Error initializing local stream:', error);
      this.events?.onError?.(error as Error);
      return null;
    }
  }

  private setupVoiceDetection() {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    const analyser = this.audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);

    const checkAudioLevel = () => {
      if (!this.localStream) return;

      const mediaStore = useMediaStore.getState();
      if (!mediaStore.isMuted) {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        mediaStore.setSpeaking(average > 30);
      }

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }

  async startScreenShare() {
    try {
      const stream = await this.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];

      // Replace video track in all peer connections
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, stream);
        }
      });

      useMediaStore.getState().setScreenSharing(true);

      // Handle track end (user stops sharing)
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      this.events?.onError?.(error as Error);
      return null;
    }
  }

  async stopScreenShare() {
    const mediaStore = useMediaStore.getState();
    if (!mediaStore.isScreenSharing) return;

    try {
      // Remove video track from all peer connections
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(null);
        }
      });

      mediaStore.setScreenSharing(false);
    } catch (error) {
      console.error('Error stopping screen share:', error);
      this.events?.onError?.(error as Error);
    }
  }

  async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
    useMediaStore.getState().setMuted(!enabled);
  }

  async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
    useMediaStore.getState().setCameraOff(!enabled);
  }

  async toggleDeafen(deafened: boolean) {
    // Update all existing peer connections
    this.peerConnections.forEach(pc => {
      pc.getReceivers().forEach(receiver => {
        if (receiver.track) {
          receiver.track.enabled = !deafened;
        }
      });
    });
    useMediaStore.getState().setDeafened(deafened);
  }

  async changeVideoDevice(deviceId: string) {
    try {
      const stream = await this.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      const videoTrack = stream.getVideoTracks()[0];

      // Replace video track in all peer connections
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Update local stream
      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          this.localStream.removeTrack(oldTrack);
        }
        this.localStream.addTrack(videoTrack);
      } else {
        this.localStream = stream;
      }

      useMediaStore.getState().setVideoInput(deviceId);
    } catch (error) {
      console.error('Error changing video device:', error);
      this.events?.onError?.(error as Error);
    }
  }

  async changeAudioDevice(deviceId: string) {
    try {
      const stream = await this.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      const audioTrack = stream.getAudioTracks()[0];

      // Replace audio track in all peer connections
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(audioTrack);
        }
      });

      // Update local stream
      if (this.localStream) {
        const oldTrack = this.localStream.getAudioTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          this.localStream.removeTrack(oldTrack);
        }
        this.localStream.addTrack(audioTrack);
      } else {
        this.localStream = stream;
      }

      // Reset voice detection with new track
      this.setupVoiceDetection();

      useMediaStore.getState().setAudioInput(deviceId);
    } catch (error) {
      console.error('Error changing audio device:', error);
      this.events?.onError?.(error as Error);
    }
  }

  closePeerConnection(userId: string) {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
      useUserStore.getState().removePeerConnection(userId);
    }
  }

  closeAllConnections() {
    console.log("CLOSE : ", this.peerConnections, this.localStream, this.audioContext);
    this.peerConnections.forEach((pc, userId) => {
      pc.close();
      useUserStore.getState().removePeerConnection(userId);
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  dispose() {
    this.closeAllConnections();
    this.events = null;
    WebRTCConnection.instance = null;
  }
}