import React, { useState, useRef } from 'react';
import { FaFileUpload } from 'react-icons/fa';

interface FileUploadBoxProps {
  handleFileUpload: (file: File) => void;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ handleFileUpload }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = () => {
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
      setUploadedFile(file);
    }
  };

  const handleFileInputClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      setUploadedFile(file);
    }
  };

  return (
    <div
      className={`w-full h-full bg-[#232428] border border-gray-600 rounded-lg mx-auto ${
        isDragActive ? 'border-2 border-blue-500 ' : 'border border-gray-400'
      } flex justify-center items-center flex-col cursor-pointer`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleFileInputClick}
    >
      <div className="text-center">
        <FaFileUpload size={50} color="#007bff" className="mx-auto" />
        {uploadedFile ? (
          <p className="mt-4 text-white font-semibold">Uploaded file: {uploadedFile.name}</p>
        ) : (
          <h2 className="mt-4 text-white font-semibold">Drag and drop your file here or click to upload</h2>
        )}
      </div>
      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
    </div>
  );
};

export default FileUploadBox;
