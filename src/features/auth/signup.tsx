import { useState } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.ts';

// 1. Define the Zod schema for the form data
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  //roles: z.string().min(1, { message: "Minimum of 1 role is required." })
  roles: z.array(z.string()).min(1, { message: "Select at least one role." })
});
const AVAILABLE_ROLES = ["Admin", "Role1", "Role2", "Role3"];

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
  // 2. Use state to manage the form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>([]); 

  // 3. Use state to manage validation errors
  const [errors, setErrors] = useState({ name: '', email: '', password: '', roles: '', general: '' });

  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // Toggle checkbox handler
  const toggleRole = (role: string) => {
    setRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  // 4. Create a function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ name: '', email: '', password: '', roles: '', general: '' }); // Clear previous errors

    // Pass 'roles' to safeParse to validate all fields
    const result = signupSchema.safeParse({ name, email, password, roles });

    if (!result.success) {
      // **Added:** Detailed logging for Zod validation errors
      console.error("Form validation failed:", result.error); 

      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0] || '',
        email: fieldErrors.email?.[0] || '',
        password: fieldErrors.password?.[0] || '',
        roles: fieldErrors.roles?.[0] || '',
        general: '', 
      });
      return; // Stop the function if validation fails
    }

  if (result.success) {
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, roles }
      }
    });

    if (signUpError) {
      console.error("Supabase sign-up error:", signUpError.message);
      // Specific handling for "already registered" error
  if (signUpError.message.includes("already registered")) {
    setErrors({ ...errors, general: "This email is already in use. Please log in instead." });
    return;
  }
      setErrors({ ...errors, general: signUpError.message });
      return;
    }

    // Check if the user and session are available
    if (signUpData.user && signUpData.session) {
      console.log("Signup successful. User ID:", signUpData.user.id);
      /*
      // Now, insert into the profile table
       const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: signUpData.user.id, name, email, role }]);
      
       if (profileError) {
        console.error("Supabase profile insertion error:", profileError.message);
        setErrors({ ...errors, general: profileError.message });
        return;
       }
      
      console.log("Profile created successfully!");
      */
      navigate('/app');
    } else if (signUpData.user && !signUpData.session) {
      // This is the case where email confirmation is required
      console.log("Signup initiated. Please check your email for a confirmation link.");
      navigate('/check-email');
    } else {
      // Fallback (shouldn't normally happen)
      setErrors({ ...errors, general: "Unexpected signup state. Please try again." });
    }

  } catch (error) {
    console.error("An unexpected error occurred:", error);
    setErrors({ ...errors, general: "An unexpected error occurred. Please try again." });
    }
};
  };

  return (
    <section className="bg-muted h-screen">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <a href={logo.url}>
            <img src={logo.src} alt={logo.alt} title={logo.title} className="h-10 dark:invert" />
          </a>
          <div className="min-w-sm bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md">
            {heading && <h1 className="text-xl font-semibold">{heading}</h1>}
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-y-4">
              {errors.general && <p className="text-red-500 text-sm">{errors.general}</p>}

              <Input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}

              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}

              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}

{/* Roles with consistent Input-like UI */}
<div className="flex flex-col gap-3">
  <p className="font-medium">Select Roles:</p>
  <div className="grid grid-cols-2 gap-2">
    {AVAILABLE_ROLES.map(role => {
      const isSelected = roles.includes(role);
      return (
        <button
          type="button"
          key={role}
          onClick={() => toggleRole(role)}
          className={`h-10 w-full rounded-md border px-3 text-sm text-left transition
            ${isSelected 
              ? "bg-primary text-white border-primary shadow-sm" 
              : "bg-background text-muted-foreground hover:border-primary/50"}`}
        >
          {role}
        </button>
      );
    })}
  </div>

  {/* Show selected roles summary */}
  {roles.length > 0 && (
    <div className="text-xs text-muted-foreground">
      Selected: {roles.join(", ")}
    </div>
  )}

  {errors.roles && <p className="text-red-500 text-sm">{errors.roles}</p>}
</div>



              <Button type="submit" className="w-full">
                {buttonText}
              </Button>
            </form>
          </div>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{signupText}</p>
            <a href={loginUrl} className="text-primary font-medium hover:underline">Login</a>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup };