import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Save, 
  Settings, 
  Shield, 
  Eye,
} from "lucide-react"
import { supabase } from "../../supabaseClient"
import { defaultAdminSettings } from "../../config/adminSettings"
import type { AdminSettings as AdminSettingsType } from "../../config/adminSettings"

// Using shared AdminSettings type (includes policies/projects/banner). We'll extend with local general/appearance defaults.
type LocalAdminSettings = AdminSettingsType & {
  general: {
    siteName: string
    siteUrl: string
    adminEmail: string
    timezone: string
    language: string
  }
  appearance: {
    theme: "light" | "dark" | "system"
    uiDensity: "comfortable" | "compact"
    disableAnimations: boolean
    colorBlindMode: boolean
    highContrast: boolean
    graphLabelVisibility: "all" | "hover" | "none"
    showEdgeArrows: boolean
  }
}

export function AdminSettings() {
  const [settings, setSettings] = useState<LocalAdminSettings>({
    ...defaultAdminSettings,
    // Local UI defaults
    general: {
      siteName: "My Admin Panel",
      siteUrl: "https://admin.example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      language: "en"
    },
    appearance: {
      theme: "system",
      uiDensity: "comfortable",
      disableAnimations: true,
      colorBlindMode: false,
      highContrast: false,
      graphLabelVisibility: "hover",
      showEdgeArrows: true
    }
  })

  // Useful app-specific settings (policies, projects, banner)
  useEffect(() => {
    // On first load, ensure keys exist
    setSettings((prev) => ({
      ...defaultAdminSettings,
      ...prev,
      policies: { ...defaultAdminSettings.policies, ...(prev as any).policies },
      projects: { ...defaultAdminSettings.projects, ...(prev as any).projects },
      banner: { ...defaultAdminSettings.banner, ...(prev as any).banner },
    }))
  }, [])

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // Load settings: Supabase first, then localStorage fallback
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'admin_settings')
          .single()

        if (mounted) {
          if (!error && data?.value) {
            setSettings((prev) => ({ ...prev, ...(data.value as Partial<LocalAdminSettings>) }))
            setBanner({ type: 'info', text: 'Loaded admin settings' })
          } else {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('admin_settings') : null
            if (raw) {
              try {
                const parsed = JSON.parse(raw)
                setSettings((prev) => ({ ...prev, ...(parsed as Partial<LocalAdminSettings>) }))
                setBanner({ type: 'info', text: 'Loaded settings from local' })
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setIsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = { key: 'admin_settings', value: settings }
      const { error } = await supabase.from('admin_settings').upsert(payload, { onConflict: 'key' })
      if (error) throw error
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_settings', JSON.stringify(settings))
      }
      setBanner({ type: 'success', text: 'Settings saved' })
    } catch (e: any) {
      // Fallback to local storage when table/RLS not ready
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_settings', JSON.stringify(settings))
      }
      setBanner({ type: 'error', text: e?.message || 'Saved locally (offline mode)' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setBanner(null), 3000)
    }
  }

  // Security/Notifications/Advanced pages removed per request; related handlers removed.

  return (
    <div className="container mx-auto p-6 space-y-6">
      {banner && (
        <div className={`p-3 rounded-lg text-sm border ${
          banner.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          banner.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {banner.text}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : (isLoading ? 'Loading...' : 'Save Changes')}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Policies
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure basic application settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.general.timezone}
                    onValueChange={(value: any) => setSettings(prev => ({
                      ...prev,
                      general: { ...prev.general, timezone: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">Eastern Time</SelectItem>
                      <SelectItem value="PST">Pacific Time</SelectItem>
                      <SelectItem value="CET">Central European Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={settings.general.language}
                    onValueChange={(value: any) => setSettings(prev => ({
                      ...prev,
                      general: { ...prev.general, language: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security, Notifications pages removed */}

        {/* Policies & Projects (useful app preferences) */}
        <TabsContent value="policies">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Access & Signup</CardTitle>
                <CardDescription>Control how users sign up</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Invite-only mode</Label>
                    <p className="text-sm text-muted-foreground">Disable public signup</p>
                  </div>
                  <Switch checked={!!(settings as any).policies?.inviteOnly} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, policies: { ...(prev as any).policies, inviteOnly: v } }))} />
                </div>
                <div className="space-y-2">
                  <Label>Allowed email domains (comma-separated)</Label>
                  <Input value={(settings as any).policies?.allowedDomains?.join(', ') || ''} onChange={(e) => setSettings(prev => ({ ...prev, policies: { ...(prev as any).policies, allowedDomains: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} />
                </div>
                <div className="space-y-2">
                  <Label>Default roles for new users</Label>
                  <Input value={(settings as any).policies?.defaultRoles?.join(', ') || ''} onChange={(e) => setSettings(prev => ({ ...prev, policies: { ...(prev as any).policies, defaultRoles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Creation and cleanup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Only Admins can create projects</Label>
                  </div>
                  <Switch checked={!!(settings as any).projects?.onlyAdminsCreate} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, onlyAdminsCreate: v } }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-add creator as assignee</Label>
                  </div>
                  <Switch checked={!!(settings as any).projects?.autoAddCreator} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, autoAddCreator: v } }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-remove deleted assignees on edit</Label>
                  </div>
                  <Switch checked={!!(settings as any).projects?.autoRemoveDeletedAssignees} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, autoRemoveDeletedAssignees: v } }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max assignees per project (blank = no limit)</Label>
                  <Input type="number" min="1" value={(settings as any).projects?.maxAssignees ?? ''} onChange={(e) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, maxAssignees: e.target.value ? parseInt(e.target.value) : null } }))} />
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Global Banner</CardTitle>
                <CardDescription>Show a global message to users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable banner</Label>
                  </div>
                  <Switch checked={!!(settings as any).banner?.enabled} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, banner: { ...(prev as any).banner, enabled: v } }))} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-1">
                    <Label>Type</Label>
                    <Select value={(settings as any).banner?.type || 'info'} onValueChange={(v: any) => setSettings(prev => ({ ...prev, banner: { ...(prev as any).banner, type: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Message</Label>
                    <Input value={(settings as any).banner?.text || ''} onChange={(e) => setSettings(prev => ({ ...prev, banner: { ...(prev as any).banner, text: e.target.value } }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Appearance Settings
              </CardTitle>
              <CardDescription>
                Minimal, lab-friendly UI options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.appearance.theme}
                  onValueChange={(value: "light" | "dark" | "system") => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, theme: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uiDensity">UI Density</Label>
                <Select
                  value={settings.appearance.uiDensity}
                  onValueChange={(value: "comfortable" | "compact") => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, uiDensity: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">Choose larger spacing or fit more on screen.</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="disableAnimations">Reduce Motion</Label>
                  <div className="text-sm text-muted-foreground">Disable non-essential animations</div>
                </div>
                <Switch
                  id="disableAnimations"
                  checked={settings.appearance.disableAnimations}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, disableAnimations: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="colorBlindMode">Color‑blind Friendly</Label>
                  <div className="text-sm text-muted-foreground">Use palettes with safer contrasts</div>
                </div>
                <Switch
                  id="colorBlindMode"
                  checked={settings.appearance.colorBlindMode}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, colorBlindMode: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="highContrast">High Contrast</Label>
                  <div className="text-sm text-muted-foreground">Increase legibility for diagrams</div>
                </div>
                <Switch
                  id="highContrast"
                  checked={settings.appearance.highContrast}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, highContrast: checked }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="graphLabelVisibility">Graph Label Visibility</Label>
                <Select
                  value={settings.appearance.graphLabelVisibility}
                  onValueChange={(value: "all" | "hover" | "none") => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, graphLabelVisibility: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Show all labels</SelectItem>
                    <SelectItem value="hover">Show on hover</SelectItem>
                    <SelectItem value="none">Hide labels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showEdgeArrows">Show Edge Arrows</Label>
                  <div className="text-sm text-muted-foreground">Useful for directionality in pathways</div>
                </div>
                <Switch
                  id="showEdgeArrows"
                  checked={settings.appearance.showEdgeArrows}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, showEdgeArrows: checked }
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced page removed */}
      </Tabs>
    </div>
  )
}