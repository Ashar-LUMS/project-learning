import { Card, CardContent } from "./ui/card";
import { Lock, Mail, AlertCircle } from "lucide-react";

const UserLocked = () => (
  <main className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
    <Card className="max-w-md w-full p-8 text-center shadow-2xl rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
      <CardContent className="space-y-6 p-0">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
            Account Locked
          </h1>
          <div className="w-16 h-1 bg-gradient-to-r from-red-500 to-red-600 rounded-full mx-auto"></div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <p className="text-gray-600 leading-relaxed text-base">
            Your account has been temporarily locked due to security concerns or policy violations.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 font-medium text-sm">
                  Contact Support
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  Please reach out to our admin team to resolve this issue.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <a
            href="mailto:admin@yourapp.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <Mail className="w-4 h-4" />
            Contact Admin
          </a>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 pt-4 border-t border-gray-200">
          We're here to help you regain access to your account
        </p>
      </CardContent>
    </Card>
  </main>
);

export default UserLocked;