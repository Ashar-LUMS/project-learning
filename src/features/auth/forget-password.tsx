import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "../../supabaseClient";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState<boolean | null>(null);

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
    <div className={cn("min-h-screen bg-muted flex flex-col items-center justify-center p-4 gap-6", className)} {...props}> 
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-xl mb-1">Trouble logging in?</CardTitle>
          <CardDescription>
            Enter your email and we’ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (<><Loader2 className="animate-spin" /> Sending...</>) : (<><Mail /> Send reset link</>)}
            </Button>
          </form>

          {message && (
            <div className="flex justify-center mt-4">
              <Badge variant={isSuccess ? 'secondary' : 'destructive'} className="px-3 py-1 text-xs">
                {message}
              </Badge>
            </div>
          )}

          <div className="text-center text-sm mt-6">
            Remembered your password?{" "}
            <a href="/" className="underline underline-offset-4">Back to login</a>
          </div>
        </CardContent>
      </Card>
</div>


  );
} 
