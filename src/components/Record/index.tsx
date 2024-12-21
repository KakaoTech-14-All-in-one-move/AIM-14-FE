import { useEffect, useRef, useState } from 'react';
import CameraRecording from '@/components/Record/CameraRecording.tsx';
import ScreenSharing from '@/components/Record/ScreenSharing.tsx';
import Controls from '@/components/Record/Controls.tsx';
import AudioWaveform from '@/components/Record/AudioWaveform.tsx';
import FileUploadBox from '@/components/Record/FileUploadBox.tsx';
import { FiArrowDownLeft, FiArrowUpRight } from 'react-icons/fi';
import Draggable from 'react-draggable';

const Index = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraExpanded, setIsCameraExpanded] = useState(0);
  const [isScreenSharingExpanded, setIsScreenSharingExpanded] = useState(0);
  const [showDownload, setShowDownload] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // 모든 미디어 스트림을 정리하는 함수
  const cleanupMediaStreams = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    // 페이지 로드 시 초기화
    const initializeMedia = async () => {
      if (isCameraOn) {
        await initializeCamera();
      } else {
        await initializeAudioOnly();
      }
    };

    initializeMedia();

    // popstate 이벤트 핸들러 추가 (뒤로가기 감지)
    const handlePopState = () => {
      cleanupMediaStreams();
    };

    // beforeunload 이벤트 핸들러 추가
    const handleBeforeUnload = () => {
      cleanupMediaStreams();
    };

    // 이벤트 리스너 등록
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // cleanup 함수
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupMediaStreams();
    };
  }, []);

  const initializeCamera = async () => {
    try {
      // 기존 스트림이 있다면 모든 트랙 중지
      cleanupMediaStreams();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setCameraStream(stream);
      setError(null);
    } catch (err) {
      console.error('Error accessing camera and microphone:', err);
      setError('There was an issue accessing the camera and microphone.');
    }
  };

  const initializeAudioOnly = async () => {
    try {
      // 기존 스트림이 있다면 모든 트랙 중지
      cleanupMediaStreams();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setCameraStream(stream);
      setError(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('There was an issue accessing the microphone.');
    }
  };

  const toggleCamera = async () => {
    try {
      cleanupMediaStreams();

      const newCameraState = !isCameraOn;
      setIsCameraOn(newCameraState);

      setShowDownload(false);
      setRecordedChunks([]);

      // 새로운 스트림 시작
      if (newCameraState) {
        await initializeCamera();
      } else {
        await initializeAudioOnly();
      }
    } catch (err) {
      console.error('Error toggling camera:', err);
      setError('Failed to toggle camera/microphone.');
    }
  };
  useEffect(() => {
    // 페이지 로드 시 초기화
    const initializeMedia = async () => {
      if (isCameraOn) {
        await initializeCamera();
      } else {
        await initializeAudioOnly();
      }
    };

    initializeMedia();

    // beforeunload 이벤트 핸들러 추가
    const handleBeforeUnload = () => {
      // 카메라 스트림 정리
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      // 화면 공유 스트림 정리
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      // 녹화 중지
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };

    // 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload);

    // cleanup 함수
    return () => {
      // 이벤트 리스너 제거
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // 카메라 스트림 정리
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          track.stop();
        });
      }

      // 화면 공유 스트림 정리
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          track.stop();
        });
      }

      // MediaRecorder 정리
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // 상태 초기화
      setCameraStream(null);
      setScreenStream(null);
      setIsCameraOn(true);
      setIsSharing(false);
      setIsRecording(false);
      setShowDownload(false);
      setRecordedChunks([]);
      mediaRecorderRef.current = null;

      // 시스템 수준에서 모든 미디어 트랙 정리 시도
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(() => {
        });
    };
  }, []); // 컴포넌트 마운트/언마운트 시에만 실행


  const startRecording = async () => {
    try {
      setRecordedChunks([]);
      setShowDownload(false);

      const stream = isCameraOn
        ? cameraStream
        : await navigator.mediaDevices.getUserMedia({ audio: true });

      if (stream) {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('There was an issue starting the recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowDownload(true);
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, {
      type: isCameraOn ? 'video/webm' : 'audio/webm',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isCameraOn ? 'recording.webm' : 'audio.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenStream(stream);
      setIsSharing(true);
      setError(null);
    } catch (err) {
      console.error('Error sharing screen:', err);
      setError('There was an issue with screen sharing.');
    }
  };

  const stopSharing = () => {
    screenStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setIsSharing(false);
  };

  const toggleCameraExpand = () => {
    const newValue = isCameraExpanded === 2 ? 0 : isCameraExpanded + 1;
    setIsCameraExpanded(newValue);
    if (newValue === 2) {
      setIsScreenSharingExpanded(0);
    }
  };

  const toggleScreenSharingExpand = () => {
    const newValue = isScreenSharingExpanded === 2 ? 0 : isScreenSharingExpanded + 1;
    setIsScreenSharingExpanded(newValue);
    if (newValue === 2) {
      setIsCameraExpanded(0);
    }
  };

  const renderCameraPopup = () => (
    <Draggable bounds="parent">
      <div
        className="absolute bottom-4 right-4 w-48 h-32 bg-black text-sm rounded-lg border border-gray-300 shadow-lg z-50 overflow-hidden">
        {isCameraOn ? (
          <div className="relative w-full h-full">
            <CameraRecording stream={cameraStream} />
            {isRecording && (
              <div className="absolute top-2 left-2 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                <span className="text-white text-xs">REC</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white flex items-center justify-center h-full relative">
            <AudioWaveform isRecording={isRecording}
                           isScreenSharingExpanded={isScreenSharingExpanded} isCameraExpanded={isCameraExpanded} />
            {isRecording && (
              <div className="absolute top-2 left-2 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                <span className="text-white text-xs">REC</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Draggable>
  );

  const renderScreenSharingPopup = () => (
    <Draggable bounds="parent">
      <div
        className="absolute bottom-4 left-4 w-48 h-32 bg-gray-700 text-sm rounded-lg border border-gray-300 shadow-lg z-50 overflow-hidden">
        {screenStream ? (
          <ScreenSharing stream={screenStream} />
        ) : (
          <p className="text-white flex items-center justify-center h-full">
            {isSharing ? 'Initializing screen share...' : 'Screen sharing not started'}
          </p>
        )}
      </div>
    </Draggable>
  );

  const handleFeedbackClick = (recordedFile: Blob, attachedFile?: File) => {
    const formData = new FormData();
    formData.append('recordedFile', recordedFile);
    if (attachedFile) {
      formData.append('attachedFile', attachedFile);
    }

    fetch('YOUR_API_ENDPOINT', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Feedback submitted successfully:', data);
      })
      .catch((error) => {
        console.error('Error submitting feedback:', error);
      });
  };

  const getCameraClassName = () => {
    if (isCameraExpanded === 2) return 'flex-1 w-full';
    if (isCameraExpanded === 1) return 'flex-1 rounded-lg';
    if (isScreenSharingExpanded === 2) return 'hidden';
    return isScreenSharingExpanded === 1
      ? 'flex-[0.35] w-[35%] h-[40%] mx-auto mt-6 ml-2 mr-2 rounded-lg'
      : '';
  };

  const getRightSideClassName = () => {
    if (isCameraExpanded === 1) return 'flex-[0.35] h-full mx-auto mt-6 ml-6 rounded-lg mr-2';
    if (isCameraExpanded === 2) return 'hidden';
  };

  const getScreenSharingClassName = () => {
    if (isScreenSharingExpanded === 2) return 'flex-1 w-full h-full';
    if (isScreenSharingExpanded === 1) return 'flex-1 h-full rounded-lg';
    if (isCameraExpanded === 2) return 'hidden';
    return isCameraExpanded === 1
      ? 'flex-[0.35] h-[30%] rounded-lg border-2 border-gray-600'
      : 'flex-[0.7]';
  };

  const getFileUploadBoxClassName = () => {
    if (isScreenSharingExpanded === 1 || isScreenSharingExpanded === 2 || isCameraExpanded === 2) return 'hidden';
    if (isCameraExpanded === 1) return 'flex-[0.35] h-[30%] mt-6 rounded-lg border border-gray-700';
    return '';
  };

  return (
    <div className="h-screen w-full flex flex-col" style={{ backgroundColor: '#1E1F22' }}>
      <div className="flex-grow flex relative overflow-hidden">

        {/* 좌측 영역 (카메라) */}
        <div
          className={`flex-1 flex flex-col relative transition-all duration-500 border border-gray-600 rounded-lg bg-[#232428]
                    flex-shrink-0 m-2 mt-3 ml-2.5 ${getCameraClassName()}`}>
          {isCameraOn ? (
            <div className="relative h-full">
              <CameraRecording stream={cameraStream} />
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                  <span className="text-white text-xs">REC</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center text-white h-full relative">
              <AudioWaveform isRecording={isRecording}
                             isScreenSharingExpanded={isScreenSharingExpanded}
                             isCameraExpanded={isCameraExpanded}
                             audioStream={cameraStream} />
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                  <span className="text-white text-xs">REC</span>
                </div>
              )}
            </div>
          )}

          {isCameraExpanded === 0 && isScreenSharingExpanded === 0 && (
            <button
              onClick={toggleCameraExpand}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowUpRight size={24} />
            </button>
          )}

          {isCameraExpanded === 1 && (
            <>
              <button
                onClick={toggleCameraExpand}
                className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowUpRight size={24} />
              </button>
              <button
                onClick={() => setIsCameraExpanded(0)}
                className="absolute top-2 right-12 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowDownLeft size={24} />
              </button>
            </>
          )}

          {isCameraExpanded === 2 && (
            <button
              onClick={() => setIsCameraExpanded(0)}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowDownLeft size={24} />
            </button>
          )}

          {isCameraExpanded === 2 && renderScreenSharingPopup()}
        </div>

        {/* 우측 영역 */}
        <div
          className={`flex-1 flex flex-col relative transition-all duration-500 bg-[#1E1F22]
                    flex-shrink-0 ml-1 m-2 mt-3 mr-2.5 ${getRightSideClassName()}`}>
          {/* 화면 공유 영역 */}
          <div className={`relative transition-all duration-500 border border-gray-600 rounded-lg 
                        mb-1 ${getScreenSharingClassName()}`} style={{ overflow: 'hidden' }}>
            {screenStream ? (
              <ScreenSharing stream={screenStream} />
            ) : (
              <div className="text-white h-full flex items-center justify-center text-sm"
                   style={{ backgroundColor: '#232428' }}>
                {isSharing ? 'Initializing screen share...' : 'Screen sharing not started'}
              </div>
            )}

            {isScreenSharingExpanded === 0 && isCameraExpanded === 0 && (
              <button
                onClick={toggleScreenSharingExpand}
                className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowUpRight size={24} />
              </button>
            )}

            {isScreenSharingExpanded === 1 && (
              <>
                <button
                  onClick={toggleScreenSharingExpand}
                  className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
                >
                  <FiArrowUpRight size={24} />
                </button>
                <button
                  onClick={() => setIsScreenSharingExpanded(0)}
                  className="absolute top-2 right-12 text-white hover:bg-gray-700 p-1 rounded-full"
                >
                  <FiArrowDownLeft size={24} />
                </button>
              </>
            )}

            {isScreenSharingExpanded === 2 && (
              <button
                onClick={() => setIsScreenSharingExpanded(0)}
                className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowDownLeft size={24} />
              </button>
            )}

            {isScreenSharingExpanded === 2 && renderCameraPopup()}
          </div>

          {/* 파일 업로드 영역 */}
          <div className={`flex-[0.3] relative transition-all duration-500 rounded-b-lg
                flex items-center justify-center mt-2 ${getFileUploadBoxClassName()}`}>
            <FileUploadBox
              handleFileUpload={(file) => setAttachedFile(file || undefined)}
              disabled={isCameraOn}
            />
          </div>
        </div>
      </div>

      {/* 컨트롤 영역 */}
      <div className="flex-shrink-0 h-15">
        {error && <div className="text-red-500 text-center p-4">{error}</div>}
        <div className="flex justify-center items-center gap-4 p-4 bg-[#1E1F22]">
          <Controls
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isCameraOn={isCameraOn}
            toggleCamera={toggleCamera}
            isSharing={isSharing}
            startSharing={startSharing}
            stopSharing={stopSharing}
            isRecordingComplete={showDownload}
            downloadRecording={downloadRecording}
            onFeedbackClick={handleFeedbackClick}
            recordedFile={new Blob(recordedChunks, { type: isCameraOn ? 'video/webm' : 'audio/webm' })}
            attachedFile={attachedFile}
            cleanupMediaStreams={cleanupMediaStreams}
          />
        </div>
      </div>
    </div>
  );
};
export default Index;
