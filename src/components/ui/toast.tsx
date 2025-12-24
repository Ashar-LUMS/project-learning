/**
 * Toast notification component for user feedback
 * Replaces window.alert/confirm/prompt for better UX
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
  onClose?: () => void
}

export interface ToastContextValue {
  showToast: (props: ToastProps) => void
  showConfirm: (message: string, onConfirm: () => void) => void
  showPrompt: (message: string, defaultValue: string, onSubmit: (value: string) => void) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<(ToastProps & { id: string })[]>([])
  const [confirm, setConfirm] = React.useState<{ message: string; onConfirm: () => void } | null>(null)
  const [prompt, setPrompt] = React.useState<{ message: string; defaultValue: string; onSubmit: (value: string) => void } | null>(null)

  const showToast = React.useCallback((props: ToastProps) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...props, id }])
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      props.onClose?.()
    }, props.duration || 3000)
  }, [])

  const showConfirm = React.useCallback((message: string, onConfirm: () => void) => {
    setConfirm({ message, onConfirm })
  }, [])

  const showPrompt = React.useCallback((message: string, defaultValue: string, onSubmit: (value: string) => void) => {
    setPrompt({ message, defaultValue, onSubmit })
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, showConfirm, showPrompt }}>
      {children}
      
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5",
              toast.variant === "destructive" && "bg-red-50 border-red-200 text-red-900",
              toast.variant === "success" && "bg-green-50 border-green-200 text-green-900",
              (!toast.variant || toast.variant === "default") && "bg-white border-gray-200"
            )}
          >
            {toast.title && <div className="font-semibold mb-1">{toast.title}</div>}
            {toast.description && <div className="text-sm opacity-90">{toast.description}</div>}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <p className="mb-4">{confirm.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirm.onConfirm()
                  setConfirm(null)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt dialog */}
      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <p className="mb-4">{prompt.message}</p>
            <input
              type="text"
              defaultValue={prompt.defaultValue}
              className="w-full border rounded px-3 py-2 mb-4"
              id="prompt-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value
                  if (value) {
                    prompt.onSubmit(value)
                    setPrompt(null)
                  }
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPrompt(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('prompt-input') as HTMLInputElement
                  if (input?.value) {
                    prompt.onSubmit(input.value)
                    setPrompt(null)
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
