import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, FlaskConical, Microscope, Atom, Brain, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "../../supabaseClient";
import { Link } from "react-router-dom";

export function ForgotPasswordForm({
}: React.ComponentProps<"div">) {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState<boolean | null>(null);
  const [activeIcons, setActiveIcons] = React.useState<number[]>([]);

  const scienceIcons = [FlaskConical, Microscope, Atom, Brain];

  React.useEffect(() => {
    const iconInterval = setInterval(() => {
      const randomIcon = Math.floor(Math.random() * scienceIcons.length);
      setActiveIcons(prev => [...prev.slice(-2), randomIcon]);
    }, 2000);

    return () => {
      clearInterval(iconInterval);
    };
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(error.message);
      setIsSuccess(false);
    } else {
      setMessage("If an account with this email exists, a reset link has been sent.");
      setIsSuccess(true);
    }
    setLoading(false);
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
          <Link to="/" className="transform transition-all duration-300 hover:scale-105 mb-1 sm:mb-2">
            <img
              src="https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png"
              alt="TISON Logo"
              title="TISON"
              className="h-10 sm:h-12 md:h-14 dark:invert transition-all duration-300"
            />
          </Link>

          {/* Responsive card container - matching login card size */}
          <div className="w-full flex justify-center">
            <Card 
              className="w-full max-w-full sm:max-w-md backdrop-blur-sm bg-white/95 shadow-2xl border-0 mx-2 sm:mx-0"
              style={{
                boxShadow: '0 20px 40px rgba(47, 85, 151, 0.15)',
              }}
            >
              <CardHeader className="text-center space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6">
                <div className="flex items-center justify-start mb-2">
                  <Link 
                    to="/" 
                    className="inline-flex items-center gap-1 text-[#2f5597] hover:text-blue-700 transition-colors text-sm"
                  >
                    <ArrowLeft size={14} />
                    Back to login
                  </Link>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#2f5597] to-blue-600 bg-clip-text text-transparent">
                  Trouble logging in?
                </CardTitle>
                <CardDescription className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Enter your email and we'll send you a link to reset your password.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                <form onSubmit={handlePasswordReset} className="space-y-4 sm:space-y-5" noValidate>
                  <div className="space-y-2 sm:space-y-3">
                    <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="researcher@institution.edu"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      aria-invalid={!!message && !isSuccess}
                      className="h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                      formNoValidate
                    />
                  </div>

                  {message && (
                    <div 
                      className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm animate-fade-in ${
                        isSuccess 
                          ? "bg-green-50 border border-green-200 text-green-700" 
                          : "bg-red-50 border border-red-200 text-red-700 animate-shake"
                      }`}
                      role="alert" 
                      aria-live="polite"
                    >
                      {message}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
                    }}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Sending reset link...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Send reset link</span>
                      </div>
                    )}
                  </Button>
                </form>

                {/* Responsive login link */}
                <div className="text-gray-600 flex justify-center gap-2 text-xs sm:text-sm bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 sm:px-6 sm:py-3 border border-white/20 mt-2">
                  <p>Remembered your password?</p>
                  <Link 
                    to="/" 
                    className="text-[#2f5597] font-semibold hover:text-blue-700 transition-all duration-200"
                  >
                    Back to login
                  </Link>
                </div>
              </CardContent>
            </Card>
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
}