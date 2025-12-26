import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck } from 'lucide-react';

interface CheckEmailProps {
  heading?: string;
  message?: string;
  loginLinkText?: string;
  loginUrl?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
}

const CheckEmail = ({
  heading = "Check Your Email",
  message = "A confirmation link has been sent to your email address. Please click the link in the email to activate your account.",
  loginLinkText = "Back to Login",
  loginUrl = "/",
  logo = {
    url: "https://tison.lums.edu.pk",
    src: "https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png",
    alt: "TISON Logo",
    title: "TISON",
  },
}: CheckEmailProps) => {
  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Background pattern */}
      <div className={`absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%232f5597" fill-opacity="0.03"%3E%3Ccircle cx="30" cy="30" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]`} />

      {/* Responsive container */}
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-xs sm:max-w-sm md:max-w-md">
          {/* Logo */}
          <a 
            href={logo.url} 
            className="transform transition-all duration-300 hover:scale-105 mb-1 sm:mb-2"
          >
            <img
              src={logo.src}
              alt={logo.alt}
              title={logo.title}
              className="h-10 sm:h-12 md:h-14 dark:invert transition-all duration-300"
            />
          </a>

          {/* Card */}
          <div className="w-full flex justify-center">
            <Card className="w-full max-w-full sm:max-w-md transform transition-all duration-500 ease-out backdrop-blur-sm bg-white/95 shadow-2xl border-0 mx-2 sm:mx-0">
              <CardHeader className="text-center space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6">
                {/* Success Icon */}
                <div className="flex justify-center mb-2">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <MailCheck className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#2f5597] to-blue-600 bg-clip-text text-transparent">
                  {heading}
                </CardTitle>
                <CardDescription className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  We've sent you a confirmation email
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="p-3 sm:p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed text-center">
                    {message}
                  </p>
                </div>

                <div className="space-y-3">
                  <Link to={loginUrl} className="block">
                    <Button 
                      className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                      style={{
                        background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
                      }}
                    >
                      {loginLinkText}
                    </Button>
                  </Link>
                </div>

                <p className="text-xs sm:text-sm text-gray-500 text-center">
                  Didn't receive the email? Check your spam folder or{' '}
                  <Link to="/signup" className="text-[#2f5597] font-semibold hover:text-blue-700 transition-colors">
                    try again
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export { CheckEmail };
