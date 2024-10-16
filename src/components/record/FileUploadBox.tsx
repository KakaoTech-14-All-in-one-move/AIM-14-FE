import React, { useState, useRef } from 'react';
import { FaFileUpload } from 'react-icons/fa';

interface FileUploadBoxProps {
  handleFileUpload: (file: File) => void;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ handleFileUpload }) => {
  const [isDragActive, setIsDragActive] = useState(false);
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
    }
  };

  return (
    <div
      className={`mt-4 w-full p-6 bg-gray-50 border-t border-gray-600 ${
        isDragActive ? 'border-2 border-dashed border-blue-500' : 'border-dashed border-2 border-gray-400'
      } flex justify-center items-center flex-col h-40 cursor-pointer`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleFileInputClick}
    >
      <div className="text-center">
        <FaFileUpload size={50} color="#007bff" className="mx-auto" />
        <h2 className="mt-4 text-gray-800 font-semibold">Drag and drop your file here or click to upload</h2>
      </div>
      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
    </div>
  );
};

export default FileUploadBox;
