interface MediaDevice {
  deviceId: string;
  label: string;
}

export class MediaDevices {
  private static instance: MediaDevices;
  private audioInputDevices: MediaDevice[] = [];
  private audioOutputDevices: MediaDevice[] = [];
  private videoInputDevices: MediaDevice[] = [];
  private onDeviceChange?: () => void;

  private constructor() {}

  static getInstance(): MediaDevices {
    if (!MediaDevices.instance) {
      MediaDevices.instance = new MediaDevices();
    }
    return MediaDevices.instance;
  }

  async initialize() {
    try {
      await this.requestPermissions();
      await this.updateDevicesList();

      navigator.mediaDevices.addEventListener('devicechange', async () => {
        await this.updateDevicesList();
        this.onDeviceChange?.();
      });
    } catch (error) {
      console.error('Failed to initialize media devices:', error);
      throw error;
    }
  }

  private async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Failed to get media permissions:', error);
      throw error;
    }
  }

  async updateDevicesList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      this.audioInputDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${this.audioInputDevices.length + 1}`
        }));

      this.audioOutputDevices = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${this.audioOutputDevices.length + 1}`
        }));

      this.videoInputDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${this.videoInputDevices.length + 1}`
        }));
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      throw error;
    }
  }

  setOnDeviceChange(callback: () => void) {
    this.onDeviceChange = callback;
  }

  getAudioInputDevices(): MediaDevice[] {
    return this.audioInputDevices;
  }

  getAudioOutputDevices(): MediaDevice[] {
    return this.audioOutputDevices;
  }

  getVideoInputDevices(): MediaDevice[] {
    return this.videoInputDevices;
  }

  async changeAudioInput(deviceId: string): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false
    });
  }

  async changeVideoInput(deviceId: string): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: { exact: deviceId },
        width: 640,
        height: 480,
        frameRate: 30
      }
    });
  }

  async setSinkId(element: HTMLMediaElement, deviceId: string): Promise<void> {
    if ('setSinkId' in element) {
      try {
        // @ts-ignore: setSinkId exists but TypeScript doesn't know about it
        await element.setSinkId(deviceId);
      } catch (error) {
        console.error('Failed to set audio output device:', error);
        throw error;
      }
    } else {
      throw new Error('setSinkId is not supported in this browser');
    }
  }
}