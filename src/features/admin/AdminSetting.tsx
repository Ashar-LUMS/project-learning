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
  AlertTriangle
} from "lucide-react"
import { supabase } from "../../supabaseClient"
import { defaultAdminSettings } from "../../config/adminSettings"
import type { AdminSettings as AdminSettingsType } from "../../config/adminSettings"

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

  useEffect(() => {
    setSettings((prev) => ({
      ...defaultAdminSettings,
      ...prev,
      policies: { ...defaultAdminSettings.policies, ...(prev as any).policies },
      projects: { ...defaultAdminSettings.projects, ...(prev as any).projects },
      banner: { ...defaultAdminSettings.banner, ...(prev as any).banner },
    }))
  }, [])

  const [isSaving, setIsSaving] = useState(false)
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'admin_settings')
          .single()
        if (!mounted) return
        if (!error && data?.value) {
          setSettings((prev) => ({ ...prev, ...(data.value as Partial<LocalAdminSettings>) }))
          setBannerMsg({ type: 'info', text: 'Loaded admin settings' })
        } else {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('admin_settings') : null
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              setSettings((prev) => ({ ...prev, ...(parsed as Partial<LocalAdminSettings>) }))
              setBannerMsg({ type: 'info', text: 'Loaded settings from local' })
            } catch { /* ignore */ }
          }
        }
      } catch {
        // ignore
      } finally { /* nothing */ }
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
      // Apply general settings immediately to the document
      try {
        const root = document.documentElement
        const lang = (settings as any)?.general?.language || 'en'
        const tz = (settings as any)?.general?.timezone || 'UTC'
        root.setAttribute('lang', lang)
        root.setAttribute('data-timezone', tz)
        // Apply policy attributes immediately
        const pol = (settings as any)?.policies || {}
        // clear first
        root.removeAttribute('data-invite-only')
        root.removeAttribute('data-allowed-domains')
        root.removeAttribute('data-default-roles')
        root.removeAttribute('data-policy-auto-lock-new-users')
        if (pol.inviteOnly) root.setAttribute('data-invite-only', '')
        const allowed = Array.isArray(pol.allowedDomains) ? pol.allowedDomains.join(',') : ''
        if (allowed) root.setAttribute('data-allowed-domains', allowed)
        const defaultRoles = Array.isArray(pol.defaultRoles) ? pol.defaultRoles.join(',') : ''
        if (defaultRoles) root.setAttribute('data-default-roles', defaultRoles)
        if (pol.autoLockNewUsers) root.setAttribute('data-policy-auto-lock-new-users', '')
      } catch { /* ignore */ }
      setBannerMsg({ type: 'success', text: 'Settings saved' })
    } catch (e: any) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_settings', JSON.stringify(settings))
      }
      setBannerMsg({ type: 'error', text: e?.message || 'Saved locally (offline mode)' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setBannerMsg(null), 3000)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        {bannerMsg && (
          <div className={`p-3 rounded-lg text-sm border ${
            bannerMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
            bannerMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
            'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {bannerMsg.text}
          </div>
        )}
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
                      <SelectItem value="PKT">Pakistan Time</SelectItem>
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
                      <SelectItem value="fr">French</SelectItem>
                      
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security/Notifications/Advanced removed */}

        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Appearance Settings
              </CardTitle>
              <CardDescription>UI options for BIRL Admins</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies & Projects */}
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
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-lock new users</Label>
                    <p className="text-sm text-muted-foreground">Require admin to unlock after signup</p>
                  </div>
                  <Switch checked={!!(settings as any).policies?.autoLockNewUsers} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, policies: { ...(prev as any).policies, autoLockNewUsers: v } }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Creation and collaboration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Warning Banner */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-800">
                        System Configuration
                      </p>
                      <p className="text-sm text-red-700">
                        These settings control core application behavior and affect how projects are managed system-wide. 
                        Changes here will impact all users and project workflows.
                      </p>
                    </div>
                  </div>
                </div>

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
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Prevent duplicate project names</Label>
                  </div>
                  <Switch checked={!!(settings as any).projects?.preventDuplicateNames} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, preventDuplicateNames: v } }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Only Admins can edit assignees</Label>
                  </div>
                  <Switch checked={!!(settings as any).projects?.onlyAdminsEditAssignees} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, onlyAdminsEditAssignees: v } }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Disallow empty assignees</Label>
                  </div>
                  <Switch checked={!!(settings as any).projects?.disallowEmptyAssignees} onCheckedChange={(v: any) => setSettings(prev => ({ ...prev, projects: { ...(prev as any).projects, disallowEmptyAssignees: v } }))} />
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
      </Tabs>
    </div>
  )
}