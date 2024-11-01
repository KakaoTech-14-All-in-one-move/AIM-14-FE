import React from 'react';

interface SocialLoginButtonProps {
  provider: 'google' | 'naver' | 'kakao';
}

const SocialLoginButton: React.FC<SocialLoginButtonProps> = ({ provider }) => {
  const getOAuthUrl = () => {
    switch (provider) {
      case 'google':
        return "http://localhost:8080/oauth2/authorization/google";
      case 'naver':
        return "http://localhost:8080/oauth2/authorization/naver";
      case 'kakao':
        return "http://localhost:8080/oauth2/authorization/kakao";
    }
  };

  const handleSocialLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = getOAuthUrl();
  };

  const getButtonContent = () => {
    switch (provider) {
      case 'google':
        return <img src="/google_login_logo.webp" alt="Google Login" className="h-12 bg-white rounded-full" />;
      case 'naver':
        return <img src="/naver_login_logo.png" alt="Naver Login" className="h-12" />;
      case 'kakao':
        return <img src="/kakao_login_logo.png" alt="Kakao Login" className="h-12" />;
    }
  };

  return (
    <a
      href={getOAuthUrl()}
      onClick={handleSocialLogin}
      className="flex justify-center items-center w-full cursor-pointer"
    >
      {getButtonContent()}
    </a>
  );
};

export default SocialLoginButton;
