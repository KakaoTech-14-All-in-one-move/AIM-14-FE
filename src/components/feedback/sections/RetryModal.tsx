interface RetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

export const RetryModal = ({
                             isOpen,
                             onClose,
                             message,
                           }: RetryModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">알림</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};