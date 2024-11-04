import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMemberStore } from '@/stores/memberStore';
import type { RegisterRequest } from '@/types/auth.types';

interface FormErrors {
  email?: string;
  password?: string;
  passwordConfirm?: string;
  username?: string;
}

interface FormData {
  email: string;
  password: string;
  passwordConfirm: string;
  username: string;
}

interface FormValidState {
  email: boolean;
  password: boolean;
  passwordConfirm: boolean;
  username: boolean;
}

const RegisterMember: React.FC = () => {
  const { isRegisterOpen, closeRegister } = useMemberStore();
  const { checkEmail, register, isLoading } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    passwordConfirm: '',
    username: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [validFields, setValidFields] = useState<FormValidState>({
    email: false,
    password: false,
    passwordConfirm: false,
    username: false,
  });

  const validateEmail = async (email: string) => {
    if (!email) {
      setErrors(prev => ({ ...prev, email: '이메일을 입력해주세요' }));
      setValidFields(prev => ({ ...prev, email: false }));
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors(prev => ({ ...prev, email: '올바른 이메일 형식이 아닙니다' }));
      setValidFields(prev => ({ ...prev, email: false }));
      return false;
    }

    try {
      const exists = await checkEmail(email);
      if (exists) {
        setErrors(prev => ({ ...prev, email: '이미 사용중인 이메일입니다' }));
        setValidFields(prev => ({ ...prev, email: false }));
        return false;
      }
      setErrors(prev => ({ ...prev, email: undefined }));
      setValidFields(prev => ({ ...prev, email: true }));
      return true;
    } catch (error) {
      setErrors(prev => ({ ...prev, email: '이메일 확인 중 오류가 발생했습니다' }));
      setValidFields(prev => ({ ...prev, email: false }));
      return false;
    }
  };

  const validatePassword = (password: string, passwordConfirm: string): boolean => {
    let isValid = true;

    if (!password) {
      setErrors(prev => ({ ...prev, password: '비밀번호를 입력해주세요' }));
      isValid = false;
    } else if (password.length < 8) {
      setErrors(prev => ({ ...prev, password: '비밀번호는 8자 이상이어야 합니다' }));
      isValid = false;
    } else {
      setErrors(prev => ({ ...prev, password: undefined }));
    }

    if (password !== passwordConfirm) {
      setErrors(prev => ({ ...prev, passwordConfirm: '비밀번호가 일치하지 않습니다' }));
      isValid = false;
    } else if (passwordConfirm && password.length >= 8) {
      setErrors(prev => ({ ...prev, passwordConfirm: undefined }));
    }

    setValidFields(prev => ({
      ...prev,
      password: isValid && password.length >= 8,
      passwordConfirm: isValid && password === passwordConfirm && password.length >= 8
    }));

    return isValid;
  };

  const validateUsername = (username: string): boolean => {
    if (!username) {
      setErrors(prev => ({ ...prev, username: '닉네임을 입력해주세요' }));
      setValidFields(prev => ({ ...prev, username: false }));
      return false;
    }

    if (username.length < 2) {
      setErrors(prev => ({ ...prev, username: '닉네임은 2자 이상이어야 합니다' }));
      setValidFields(prev => ({ ...prev, username: false }));
      return false;
    }

    setErrors(prev => ({ ...prev, username: undefined }));
    setValidFields(prev => ({ ...prev, username: true }));
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password' || name === 'passwordConfirm') {
      validatePassword(
        name === 'password' ? value : formData.password,
        name === 'passwordConfirm' ? value : formData.passwordConfirm
      );
    } else if (name === 'username') {
      validateUsername(value);
    }
  };

  const handleEmailBlur = async () => {
    if (formData.email) {
      await validateEmail(formData.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const isEmailValid = await validateEmail(formData.email);
    const isPasswordValid = validatePassword(formData.password, formData.passwordConfirm);
    const isUsernameValid = validateUsername(formData.username);

    if (!isEmailValid || !isPasswordValid || !isUsernameValid) {
      return;
    }

    try {
      const registerData: RegisterRequest = {
        email: formData.email,
        password: formData.password,
        username: formData.username,
      };

      await register(registerData);
      closeRegister();
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  if (!isRegisterOpen) return null;

  const getInputClassName = (fieldName: keyof FormErrors) => `
    w-full px-4 py-2 border rounded-md bg-discord500 text-white
    ${!isLoading && errors[fieldName]
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : validFields[fieldName]
        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
        : 'border-discord600 focus:border-yellow-300 focus:ring-yellow-300'
    }
    focus:outline-none
  `;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="w-full max-w-md p-8 space-y-6 rounded-xl bg-discord700">
        <h2 className="text-2xl font-bold text-center text-kakaoYellow pb-3">회원가입</h2>
        <form className="space-y-6 mt-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              onBlur={handleEmailBlur}
              className={getInputClassName('email')}
              placeholder="이메일을 입력하세요"
            />
            {isLoading ? (
              <p className="text-sm text-yellow-300 mt-1">이메일 확인 중...</p>
            ) : (
              errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )
            )}
          </div>

          <div className="space-y-1">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={getInputClassName('password')}
              placeholder="비밀번호를 입력하세요"
            />
            {errors.password && (
              <p className="text-sm text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          <div className="space-y-1">
            <input
              type="password"
              name="passwordConfirm"
              value={formData.passwordConfirm}
              onChange={handleInputChange}
              className={getInputClassName('passwordConfirm')}
              placeholder="비밀번호를 다시 입력하세요"
            />
            {errors.passwordConfirm && (
              <p className="text-sm text-red-500 mt-1">{errors.passwordConfirm}</p>
            )}
          </div>

          <div className="space-y-1">
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={getInputClassName('username')}
              placeholder="닉네임을 입력하세요"
            />
            {errors.username && (
              <p className="text-sm text-red-500 mt-1">{errors.username}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 font-medium text-kakaoBrown bg-kakaoYellow rounded-md 
                    hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-kakaoBrown
                    disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리중...' : '회원가입'}
          </button>
        </form>

        <button
          onClick={closeRegister}
          className="mt-1 w-full text-sm text-gray-500 hover:underline"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default RegisterMember;