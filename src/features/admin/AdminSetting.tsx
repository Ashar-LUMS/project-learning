import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Save, 
  Settings, 
  Shield, 
  Bell, 
  Database, 
  Eye,
} from "lucide-react"

interface AdminSettings {
  general: {
    siteName: string
    siteUrl: string
    adminEmail: string
    timezone: string
    language: string
  }
  security: {
    twoFactorAuth: boolean
    sessionTimeout: number
    passwordPolicy: {
      minLength: number
      requireNumbers: boolean
      requireSymbols: boolean
    }
    ipWhitelist: string[]
  }
  notifications: {
    emailNotifications: boolean
    securityAlerts: boolean
    systemUpdates: boolean
    userActivity: boolean
  }
  appearance: {
    theme: "light" | "dark" | "system"
    sidebarCollapsed: boolean
    compactMode: boolean
  }
}

export function AdminSettings() {
  const [settings, setSettings] = useState<AdminSettings>({
    general: {
      siteName: "My Admin Panel",
      siteUrl: "https://admin.example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      language: "en"
    },
    security: {
      twoFactorAuth: true,
      sessionTimeout: 30,
      passwordPolicy: {
        minLength: 8,
        requireNumbers: true,
        requireSymbols: true
      },
      ipWhitelist: ["192.168.1.1", "10.0.0.1"]
    },
    notifications: {
      emailNotifications: true,
      securityAlerts: true,
      systemUpdates: false,
      userActivity: true
    },
    appearance: {
      theme: "system",
      sidebarCollapsed: false,
      compactMode: false
    }
  })

  const [newIp, setNewIp] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log("Settings saved:", settings)
    setIsSaving(false)
  }

  const addIpToWhitelist = () => {
    if (newIp && !settings.security.ipWhitelist.includes(newIp)) {
      setSettings(prev => ({
        ...prev,
        security: {
          ...prev.security,
          ipWhitelist: [...prev.security.ipWhitelist, newIp]
        }
      }))
      setNewIp("")
    }
  }

  const removeIpFromWhitelist = (ip: string) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        ipWhitelist: prev.security.ipWhitelist.filter(item => item !== ip)
      }
    }))
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Advanced
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
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={settings.general.siteName}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      general: { ...prev.general, siteName: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteUrl">Site URL</Label>
                  <Input
                    id="siteUrl"
                    type="url"
                    value={settings.general.siteUrl}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      general: { ...prev.general, siteUrl: e.target.value }
                    }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={settings.general.adminEmail}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    general: { ...prev.general, adminEmail: e.target.value }
                  }))}
                />
              </div>

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

        {/* Security Settings */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security preferences and access controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="twoFactor">Two-Factor Authentication</Label>
                    <div className="text-sm text-muted-foreground">
                      Require 2FA for all admin users
                    </div>
                  </div>
                  <Switch
                    id="twoFactor"
                    checked={settings.security.twoFactorAuth}
                    onCheckedChange={(checked: any) => setSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, twoFactorAuth: checked }
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="1440"
                    value={settings.security.sessionTimeout}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
                    }))}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Password Policy</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minLength">Minimum Length</Label>
                      <Input
                        id="minLength"
                        type="number"
                        min="6"
                        max="20"
                        value={settings.security.passwordPolicy.minLength}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            passwordPolicy: {
                              ...prev.security.passwordPolicy,
                              minLength: parseInt(e.target.value)
                            }
                          }
                        }))}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requireNumbers"
                        checked={settings.security.passwordPolicy.requireNumbers}
                        onCheckedChange={(checked: any) => setSettings(prev => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            passwordPolicy: {
                              ...prev.security.passwordPolicy,
                              requireNumbers: checked
                            }
                          }
                        }))}
                      />
                      <Label htmlFor="requireNumbers">Require Numbers</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requireSymbols"
                        checked={settings.security.passwordPolicy.requireSymbols}
                        onCheckedChange={(checked: any) => setSettings(prev => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            passwordPolicy: {
                              ...prev.security.passwordPolicy,
                              requireSymbols: checked
                            }
                          }
                        }))}
                      />
                      <Label htmlFor="requireSymbols">Require Symbols</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>IP Whitelist</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter IP address"
                      value={newIp}
                      onChange={(e) => setNewIp(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addIpToWhitelist()}
                    />
                    <Button onClick={addIpToWhitelist}>Add IP</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.security.ipWhitelist.map((ip) => (
                      <Badge key={ip} variant="secondary" className="flex items-center gap-1">
                        {ip}
                        <button
                          onClick={() => removeIpFromWhitelist(ip)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Manage how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <div className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </div>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.notifications.emailNotifications}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, emailNotifications: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="securityAlerts">Security Alerts</Label>
                  <div className="text-sm text-muted-foreground">
                    Get notified about security events
                  </div>
                </div>
                <Switch
                  id="securityAlerts"
                  checked={settings.notifications.securityAlerts}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, securityAlerts: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="systemUpdates">System Updates</Label>
                  <div className="text-sm text-muted-foreground">
                    Notify about available system updates
                  </div>
                </div>
                <Switch
                  id="systemUpdates"
                  checked={settings.notifications.systemUpdates}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, systemUpdates: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="userActivity">User Activity</Label>
                  <div className="text-sm text-muted-foreground">
                    Monitor important user activities
                  </div>
                </div>
                <Switch
                  id="userActivity"
                  checked={settings.notifications.userActivity}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, userActivity: checked }
                  }))}
                />
              </div>
            </CardContent>
          </Card>
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
                Customize the look and feel of your admin panel
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sidebarCollapsed">Collapsed Sidebar</Label>
                  <div className="text-sm text-muted-foreground">
                    Start with sidebar collapsed
                  </div>
                </div>
                <Switch
                  id="sidebarCollapsed"
                  checked={settings.appearance.sidebarCollapsed}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, sidebarCollapsed: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compactMode">Compact Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Use compact spacing and smaller elements
                  </div>
                </div>
                <Switch
                  id="compactMode"
                  checked={settings.appearance.compactMode}
                  onCheckedChange={(checked: any) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, compactMode: checked }
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Work in progress: Advanced Settings
              </CardTitle>
              <CardDescription>
                Advanced configuration options for your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="debugMode">Debug Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Enable detailed logging and error reporting
                  </div>
                </div>
                <Switch id="debugMode" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenance">Maintenance Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Take the application offline for maintenance
                  </div>
                </div>
                <Switch id="maintenance" />
              </div>

              <div className="pt-4 border-t">
                <Button variant="destructive">Clear Cache</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}