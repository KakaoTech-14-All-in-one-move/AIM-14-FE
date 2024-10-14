import React from 'react';

interface SocialLoginButtonProps {
    provider: 'google' | 'naver' | 'kakao';
}

const SocialLoginButton: React.FC<SocialLoginButtonProps> = ({ provider }) => {
    const getOAuthUrl = () => {
        // TODO: oauth url로 변경
        switch (provider) {
            case 'google':
                return 'https://google.com';
            case 'naver':
                return 'https://naver.com';
            case 'kakao':
                return 'https://localhost:5173/home';
        }
    };

    const handleSocialLogin = (e: React.MouseEvent) => {
        e.preventDefault();
        window.location.href = getOAuthUrl();
    };

    const getButtonContent = () => {
        switch (provider) {
            case 'google':
                return <img src="/google_login_logo.png" alt="Google Login" className="h-12" />;
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