import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, Microscope, Atom, Brain, ArrowLeft, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "../../supabaseClient";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export function ResetPasswordPage({}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [verifying, setVerifying] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState<boolean | null>(null);
  const [activeIcons, setActiveIcons] = React.useState<number[]>([]);
  const [passwordStrength, setPasswordStrength] = React.useState<number>(0);
  const [debugInfo, setDebugInfo] = React.useState<string>("");

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

  // Debug: Log all URL parameters
  React.useEffect(() => {
    const token = searchParams.get('code');
    const type = searchParams.get('type');
    
    console.log('🔍 URL Search Params:', {
      token: token ? `${token.substring(0, 20)}...` : 'MISSING',
      type: type || 'MISSING',
      allParams: Object.fromEntries(searchParams.entries()),
      fullURL: window.location.href
    });
    
    setDebugInfo(`Token: ${token ? 'Present' : 'Missing'}, Type: ${type || 'Missing'}`);
  }, [searchParams]);

  // NEW APPROACH: Use exchangeCodeForSession instead of verifyOtp
  React.useEffect(() => {
    const initializeReset = async () => {
      const token = searchParams.get('code');
      const type = searchParams.get('type');

      if (!token || type !== 'recovery') {
        setMessage("Invalid reset link. Please make sure you're using the link from your email.");
        setIsSuccess(false);
        setVerifying(false);
        return;
      }

      try {
        setVerifying(true);
        setDebugInfo(prev => prev + " - Starting token exchange...");
        
        // Use exchangeCodeForSession instead of verifyOtp
        const { data, error } = await supabase.auth.exchangeCodeForSession(token);
        
        if (error) {
          console.error('❌ Token exchange error:', error);
          setDebugInfo(prev => prev + ` - Error: ${error.message}`);
          throw error;
        }

        console.log('✅ Token exchange successful:', data);
        setDebugInfo(prev => prev + " - Token exchange successful!");
        setMessage(null);
        
      } catch (error: any) {
        console.error('❌ Reset initialization failed:', error);
        setDebugInfo(prev => prev + ` - Failed: ${error.message}`);
        
        // Let the user try anyway - sometimes it works without exchange
        console.log('🔄 Allowing password update attempt...');
        setMessage("Note: You can try setting your new password. If it fails, please request a new reset link.");
        
      } finally {
        setVerifying(false);
      }
    };

    // Small delay to ensure Supabase is ready
    setTimeout(() => {
      initializeReset();
    }, 1000);
  }, [searchParams]);

  // Check password strength
  React.useEffect(() => {
    if (password.length === 0) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    setPasswordStrength(strength);
  }, [password]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Validation
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      setIsSuccess(false);
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Attempting password update...');
      
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error('❌ Password update error:', error);
        throw error;
      }

      console.log('✅ Password update successful:', data);
      setMessage("Password updated successfully! Redirecting to login...");
      setIsSuccess(true);
      
      // Clear form
      setPassword("");
      setConfirmPassword("");
      
      // Redirect after delay
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error: any) {
      console.error('❌ Password update failed:', error);
      setMessage(`Error: ${error.message}. Please request a new reset link.`);
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return "bg-gray-200";
    if (passwordStrength <= 2) return "bg-red-500";
    if (passwordStrength <= 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return "";
    if (passwordStrength <= 2) return "Weak";
    if (passwordStrength <= 3) return "Medium";
    return "Strong";
  };

  if (verifying) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 text-[#2f5597] mx-auto mb-4" />
          <p className="text-gray-600">Verifying reset link...</p>
          <p className="text-xs text-gray-500 mt-2">{debugInfo}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Background elements */}
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

      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-xs sm:max-w-sm md:max-w-md">
          <Link to="/" className="transform transition-all duration-300 hover:scale-105 mb-1 sm:mb-2">
            <img
              src="https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png"
              alt="TISON Logo"
              className="h-10 sm:h-12 md:h-14 dark:invert transition-all duration-300"
            />
          </Link>

          <div className="w-full flex justify-center">
            <Card className="w-full max-w-full sm:max-w-md backdrop-blur-sm bg-white/95 shadow-2xl border-0 mx-2 sm:mx-0">
              <CardHeader className="text-center space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6">
                <div className="flex items-center justify-start mb-2">
                  <Link 
                    to="/forgot-password" 
                    className="inline-flex items-center gap-1 text-[#2f5597] hover:text-blue-700 transition-colors text-sm"
                  >
                    <ArrowLeft size={14} />
                    Back to reset
                  </Link>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#2f5597] to-blue-600 bg-clip-text text-transparent">
                  Reset your password
                </CardTitle>
                <CardDescription className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Enter your new password below
                </CardDescription>
                {/* Debug info */}
                <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                  <strong>Debug:</strong> {debugInfo}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                <form onSubmit={handlePasswordUpdate} className="space-y-4 sm:space-y-5" noValidate>
                  <div className="space-y-2 sm:space-y-3">
                    <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-gray-700">
                      New Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your new password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                    />
                    
                    {password && (
                      <div className="space-y-1 animate-fade-in">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Password strength:</span>
                          <span className={`font-medium ${
                            passwordStrength <= 2 ? 'text-red-600' : 
                            passwordStrength <= 3 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {getPasswordStrengthText()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                            style={{ width: `${(passwordStrength / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 sm:space-y-3">
                    <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-medium text-gray-700">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your new password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                    />
                    
                    {confirmPassword && password !== confirmPassword && (
                      <div className="text-xs text-red-600 animate-fade-in">
                        Passwords do not match
                      </div>
                    )}
                    
                    {confirmPassword && password === confirmPassword && password.length >= 6 && (
                      <div className="flex items-center gap-1 text-xs text-green-600 animate-fade-in">
                        <CheckCircle size={12} />
                        Passwords match
                      </div>
                    )}
                  </div>

                  {message && (
                    <div 
                      className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm animate-fade-in ${
                        isSuccess 
                          ? "bg-green-50 border border-green-200 text-green-700" 
                          : "bg-red-50 border border-red-200 text-red-700"
                      }`}
                    >
                      {isSuccess && (
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} />
                          {message}
                        </div>
                      )}
                      {!isSuccess && (
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          {message}
                        </div>
                      )}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                    disabled={loading || passwordStrength < 2}
                    style={{
                      background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
                      opacity: passwordStrength < 2 ? 0.6 : 1,
                    }}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Updating password...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Lock size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Update password</span>
                      </div>
                    )}
                  </Button>
                </form>

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
    </section>
  );
}