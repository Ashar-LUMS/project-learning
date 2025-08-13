import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck } from 'lucide-react'; // Icon for email check

interface CheckEmailProps {
  heading?: string;
  message?: string;
  loginLinkText?: string;
  loginUrl?: string;
}

const CheckEmail = ({
  heading = "Check Your Email",
  message = "A confirmation link has been sent to your email address. Please click the link in the email to activate your account.",
  loginLinkText = "Back to Login",
  loginUrl = "/",
}: CheckEmailProps) => {
  return (
    <section className="bg-muted h-screen flex items-center justify-center">
      <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-xl bg-white">
        <CardContent className="space-y-6 flex flex-col items-center">
          <MailCheck className="h-16 w-16 text-blue-500" />
          {heading && <h1 className="text-3xl font-bold text-gray-900">{heading}</h1>}
          <p className="text-gray-600 leading-relaxed">
            {message}
          </p>
          <Link to={loginUrl} className="w-full">
            <Button className="w-full rounded-md mt-4">
              {loginLinkText}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </section>
  );
};

export { CheckEmail };
