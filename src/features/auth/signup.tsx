import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient.ts';
import { fetchRoleNames } from '../../roles';

const AVAILABLE_ROLES_FALLBACK = ['User'];

const signupSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  email: z.email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  roles: z.array(z.string()).min(1, { message: "Select at least one role." })
});

interface SignupProps {
  heading?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
  buttonText?: string;
  signupText?: string;
  loginUrl?: string;
}

const Signup = ({
  heading = "Sign Up",
  logo = {
    url: "https://tison.lums.edu.pk",
    src: "https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png",
    alt: "logo",
    title: "TISON",
  },
  buttonText = "Sign Up",
  signupText = "Already have an account?",
  loginUrl = "/",
}: SignupProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [errors, setErrors] = useState({ name: '', email: '', password: '', roles: '', general: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleRole = (role: string) => {
    setRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const names = await fetchRoleNames();
        if (!mounted) return;
        const normalized = (names || []).map(r => String(r).trim()).filter(Boolean).sort((a,b) => a.localeCompare(b));
        setAvailableRoles(normalized.length ? normalized : AVAILABLE_ROLES_FALLBACK);
      } catch (e) {
        if (!mounted) return;
        setAvailableRoles(AVAILABLE_ROLES_FALLBACK);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (isSubmitting) return;
  setIsSubmitting(true);
  setErrors({ name: '' , email: '' , password: '' , roles: '' , general: '' });

  if (cardRef.current) {
    cardRef.current.style.transform = 'scale(0.98)';
    setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.style.transform = 'scale(1)';
      }
    }, 150);
  }

  const result = signupSchema.safeParse({ name, email, password, roles });

  if (!result.success) {
    console.error("Form validation failed:", result.error);
    const fieldErrors = result.error.flatten().fieldErrors;
    setErrors({
      name: fieldErrors.name?.[0] || '',
      email: fieldErrors.email?.[0] || '',
      password: fieldErrors.password?.[0] || '',
      roles: fieldErrors.roles?.[0] || '',
      general: '', 
    });
    setIsSubmitting(false);
    return;
  }

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, roles, isLocked: false, redirectTo: "" }
      }
    });

    console.log("=== SIGNUP RESPONSE ===");
    console.log("signUpData:", JSON.stringify(signUpData, null, 2));
    console.log("signUpError: ", signUpError);

    // 🔴 CASE 1: Network / Supabase error
    if (signUpError) {
      console.error("Supabase sign-up error:", signUpError.message);

      if (signUpError.message.toLowerCase().includes("already registered")) {
        setErrors(prev => ({ ...prev, general: "This email is already in use. Please log in instead." }));
      } else if (signUpError.message.toLowerCase().includes("invalid email")) {
        setErrors(prev => ({ ...prev, general: "Invalid email format. Please try again." }));
      } else if (signUpError.message.toLowerCase().includes("weak password")) {
        setErrors(prev => ({ ...prev, general: "Your password is too weak. Use at least 6 characters." }));
      } else {
        setErrors(prev => ({ ...prev, general: signUpError.message }));
      }

      setIsSubmitting(false);
      return;
    }

    // 🟢 CASE 2: Signup successful with session (auto-login enabled)
    if (signUpData?.user && signUpData.session) {
      console.log("Signup successful. User ID:", signUpData.user.id);
      navigate('/app');
      setIsSubmitting(false);
      return;
    } 

    // 🟡 CASE 3: Signup successful, no session (email confirmation required)
    if (signUpData?.user && !signUpData.session) {
      if (!signUpData.user.identities || signUpData.user.identities.length === 0) {
        // 🔴 CASE 3a: Duplicate email → no identities returned
        setErrors(prev => ({
          ...prev,
          general: "This email is already in use. Please log in instead."
        }));
      } else {
        // 🟡 CASE 3b: Valid signup, but confirmation pending
        console.log("Signup initiated. Please check your email for a confirmation link.");
        navigate('/check-email');
      }
      setIsSubmitting(false);
      return;
    }

    // ⚪ CASE 4: Unexpected edge case
    console.warn("Unexpected signup response:", signUpData);
    setErrors(prev => ({
      ...prev,
      general: "Something went wrong during signup. Please try again."
    }));
    setIsSubmitting(false);

  } catch (error) {
    console.error("An unexpected error occurred:", error);
    setErrors(prev => ({ ...prev, general: "Unexpected error. Please try again later." }));
    setIsSubmitting(false);
  }
};


  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Background elements with responsive sizing */}
      <div className="absolute inset-0 overflow-hidden">

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
              // style={{
              //   transform: isAnimating ? 'translateY(20px) scale(0.95)' : 'translateY(0) scale(1)',
              //   opacity: isAnimating ? 0 : 1,
              //   boxShadow: '0 20px 40px rgba(47, 85, 151, 0.15)',
              // }}
            >
              <CardHeader className="text-center space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6">
                <div className="relative">
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#2f5597] to-blue-600 bg-clip-text text-transparent">
                    {heading}
                  </CardTitle>
                </div>
                <CardDescription className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Create an account to access advanced cancer modeling tools.
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
                    <Label htmlFor="name" className="text-xs sm:text-sm font-medium text-gray-700">
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Dr. Jane Researcher"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSubmitting}
                      aria-invalid={!!errors.name}
                      className="h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                      formNoValidate
                    />
                    {errors.name && (
                      <p className="text-red-600 text-xs animate-fade-in flex items-center gap-1">
                        <span>•</span>{errors.name}
                      </p>
                    )}
                  </div>

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
                    <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      aria-invalid={!!errors.password}
                      className="h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 rounded-lg sm:rounded-xl px-3 sm:px-4"
                      formNoValidate
                    />
                    {errors.password && (
                      <p className="text-red-600 text-xs animate-fade-in flex items-center gap-1">
                        <span>•</span>{errors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">
                      Select Roles
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(availableRoles || []).map(role => {
                        const isSelected = roles.includes(role);
                        return (
                          <button
                            type="button"
                            key={role}
                            onClick={() => toggleRole(role)}
                            className={`h-10 w-full rounded-lg border-2 px-3 text-sm text-left transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                              ${isSelected 
                                ? "bg-[#2f5597] text-white border-[#2f5597] shadow-sm" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-[#2f5597]/50"}`}
                            disabled={isSubmitting}
                          >
                            {isSelected ? (
                              <span className="inline-flex items-center gap-2 text-xs">
                                <CheckCircle2 size={14} /> {role}
                              </span>
                            ) : (
                              <span className="text-xs">{role}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {roles.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">Selected: {roles.join(", ")}</div>
                    )}
                    {errors.roles && (
                      <p className="text-red-600 text-xs animate-fade-in flex items-center gap-1">
                        <span>•</span>{errors.roles}
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
                        <span>Creating Account...</span>
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

          {/* Responsive login link */}
          <div className="text-gray-600 flex justify-center gap-2 text-xs sm:text-sm bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 sm:px-6 sm:py-3 border border-white/20 mt-1 sm:mt-2">
            <p>{signupText}</p>
            <Link 
              to={loginUrl} 
              className="text-[#2f5597] font-semibold hover:text-blue-700 transition-all duration-200"
            >
              Login
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

export { Signup };