import React, { useState, useRef } from 'react';
import { FaFileUpload, FaCheckCircle, FaTrashAlt } from 'react-icons/fa';

interface FileUploadBoxProps {
  handleFileUpload: (file: File) => void;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ handleFileUpload }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadComplete, setIsUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = () => setIsDragActive(false);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) simulateUpload(file);
  };

  const handleFileInputClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
  };

  const simulateUpload = (file: File) => {
    handleFileUpload(file);
    setUploadedFile(file);
    setUploadProgress(0);
    setIsUploadComplete(false);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploadComplete(true);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const handleFileDelete = () => {
    setUploadedFile(null);
    setUploadProgress(0);
    setIsUploadComplete(false);
  };

  return (
    <div
      style={{
        border: `1px solid ${isDragActive ? '#FEE500' : '#4A5568'}`,
      }}
      className="w-full h-full bg-[#232428] rounded-lg mx-auto flex justify-center items-center flex-col cursor-pointer transition-all duration-300"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleFileInputClick}
    >
      <div
        className={`text-center relative transition-all duration-500 ${
          isUploadComplete ? 'mt-4' : ''
        }`}
      >
        {isUploadComplete && uploadedFile ? (
          <FaCheckCircle
            size={50}
            color="#FEE500"
            className="mx-auto absolute -top-12 left-1/2 transform -translate-x-1/2"
          />
        ) : (
          <FaFileUpload size={50} color="#007bff" className="mx-auto" />
        )}

        {uploadedFile ? (
          <div className="flex items-center mt-4">
            <p className="text-white font-semibold mr-2">{uploadedFile.name}</p>
            <button
              className="text-red-500 hover:text-red-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleFileDelete();
              }}
            >
              <FaTrashAlt size={20} />
            </button>
          </div>
        ) : (
          <h2 className="mt-4 text-white font-semibold">
            Drag and drop your file here or click to upload
          </h2>
        )}
      </div>

      {uploadedFile && !isUploadComplete && (
        <div className="w-3/4 bg-gray-300 rounded-full h-2 mt-4 overflow-hidden">
          <div
            className="bg-[#FEE500] h-full transition-all duration-500"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default FileUploadBox;
