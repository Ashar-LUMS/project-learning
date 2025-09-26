import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, FlaskConical, Microscope, Atom, Brain } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import { supabase } from '../../supabaseClient.ts';

const loginSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address."
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters."
  }),
});

interface LoginProps {
  heading?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
  buttonText?: string;
  googleText?: string;
  signupText?: string;
  signupUrl?: string;
}

const Login = ({
  heading = "Login",
  logo = {
    url: "https://tison.lums.edu.pk",
    src: "https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png",
    alt: "logo",
    title: "TISON",
  },
  buttonText = "Login",
  signupText = "Need an account?",
  signupUrl = "/signup",
}: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });
  const [isAnimating, setIsAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scienceIcons = [FlaskConical, Microscope, Atom, Brain];
  const [activeIcons, setActiveIcons] = useState<number[]>([]);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 1000);

    const iconInterval = setInterval(() => {
      const randomIcon = Math.floor(Math.random() * scienceIcons.length);
      setActiveIcons(prev => [...prev.slice(-2), randomIcon]);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(iconInterval);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (cardRef.current) {
      cardRef.current.style.transform = 'scale(0.98)';
      setTimeout(() => {
        if (cardRef.current) {
          cardRef.current.style.transform = 'scale(1)';
        }
      }, 150);
    }

    const result = loginSchema.safeParse({ email, password });

    if (result.success) {
      setErrors({ email: '', password: '', general: '' });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error(error.message);
        setErrors({ email: '', password: '', general: error.message });
        setIsSubmitting(false);
        return;
      } else if (data.user) {
        console.log("Login successful!", data);
        navigate('/app');
        setIsSubmitting(false);
      }
    } else {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === "email") fieldErrors.email = issue.message;
        if (issue.path[0] === "password") fieldErrors.password = issue.message;
      });
      setErrors({ email: fieldErrors.email || '', password: fieldErrors.password || '', general: '' });
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Background elements with responsive sizing */}
      <div className="absolute inset-0 overflow-hidden">
        {activeIcons.map((iconIndex, index) => {
          const IconComponent = scienceIcons[iconIndex];
          return (
            <div
              key={index}
              className="absolute opacity-5 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${index * 0.5}s`,
              }}
            >
              <IconComponent className="w-8 h-8 md:w-12 md:h-12 text-[#2f5597]" />
            </div>
          );
        })}
      </div>

      <div className={`absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%232f5597\" fill-opacity=\"0.03\"%3E%3Ccircle cx=\"30\" cy=\"30\" r=\"1\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse-slow`} />

      {/* Responsive container with better padding */}
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-xs sm:max-w-sm md:max-w-md">
          {/* Responsive logo */}
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

          {/* Responsive card container */}
          <div className="w-full flex justify-center">
            <Card 
              ref={cardRef}
              className="w-full max-w-full sm:max-w-md transform transition-all duration-500 ease-out backdrop-blur-sm bg-white/95 shadow-2xl border-0 mx-2 sm:mx-0"
              style={{
                transform: isAnimating ? 'translateY(20px) scale(0.95)' : 'translateY(0) scale(1)',
                opacity: isAnimating ? 0 : 1,
                boxShadow: '0 20px 40px rgba(47, 85, 151, 0.15)',
              }}
            >
              <CardHeader className="text-center space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6">
                <div className="relative">
                  {/* <div className="absolute -top-1 -left-1 w-2 h-2 sm:w-3 sm:h-3 bg-[#2f5597] rounded-full animate-ping opacity-75"></div> */}
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#2f5597] to-blue-600 bg-clip-text text-transparent">
                    {heading}
                  </CardTitle>
                </div>
                <CardDescription className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Welcome back. Please sign in to access advanced cancer modeling tools.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
                  {errors.general && (
                    <div 
                      className="p-2 sm:p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm animate-shake"
                      role="alert" 
                      aria-live="polite"
                    >
                      {errors.general}
                    </div>
                  )}

                  <div className="space-y-2 sm:space-y-3">
                    <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="researcher@institution.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      aria-invalid={!!errors.email}
                      className="h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                      formNoValidate
                    />
                    {errors.email && (
                      <p className="text-red-600 text-xs animate-fade-in flex items-center gap-1">
                        <span>•</span>{errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-gray-700">
                        Password
                      </Label>
                      <button
                        type="button"
                        className="text-xs text-[#2f5597] font-medium hover:text-blue-700 transition-colors duration-200 cursor-pointer"
                        onClick={() => navigate('/forgot-password')}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        aria-invalid={!!errors.password}
                        className="h-10 sm:h-12 text-sm sm:text-base pr-10 sm:pr-12 transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                        formNoValidate
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 sm:px-4 text-gray-400 hover:text-[#2f5597] transition-all duration-200 hover:scale-110"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye size={16} className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-600 text-xs animate-fade-in flex items-center gap-1">
                        <span>•</span>{errors.password}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                    disabled={isSubmitting}
                    style={{
                      background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
                    }}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Authenticating...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{buttonText}</span>
                      </div>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Responsive signup link */}
          <div className="text-gray-600 flex justify-center gap-2 text-xs sm:text-sm bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 sm:px-6 sm:py-3 border border-white/20 mt-1 sm:mt-2">
            <p>{signupText}</p>
            <Link 
              to={signupUrl} 
              className="text-[#2f5597] font-semibold hover:text-blue-700 transition-all duration-200"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};

export { Login };