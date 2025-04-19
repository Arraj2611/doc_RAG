import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Camera, Lock, Mail, Save, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function ProfileSettings() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
    }
  }, [user]);

  const handleSaveProfile = () => {
    console.log("Saving profile with data:", { displayName });
    toast({
      title: "Profile update requested",
      description: "Saving profile information... (API call needed)",
    });
  };

  const handleAvatarUpload = () => {
    toast({
      title: "Feature not implemented",
      description: "Avatar upload would be implemented in a production version.",
    });
  };

  if (isLoading) {
    return <div className="p-6">Loading profile...</div>;
  }

  if (!user) {
    return <div className="p-6 text-red-500">Failed to load user profile.</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto p-6"
    >
      <h2 className="text-2xl font-display font-bold text-gray-800 dark:text-white mb-6">Profile Settings</h2>
      
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-gray-100/50 dark:bg-gray-800/50 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-primary/10 rounded-md">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="ai-preferences" className="data-[state=active]:bg-primary/10 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
              <path d="M12 8V4H8"></path>
              <rect width="16" height="12" x="4" y="8" rx="2"></rect>
              <path d="M2 14h2"></path>
              <path d="M20 14h2"></path>
              <path d="M15 13v2"></path>
              <path d="M9 13v2"></path>
            </svg>
            AI Preferences
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-primary/10 rounded-md">
            <Lock className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-primary/10 rounded-md">
            <Mail className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-primary">
                    {user && 'image' in user && user.image ? (
                      <AvatarImage src={user.image as string} alt={user.displayName || user.username || 'User'} />
                    ) : (
                      <AvatarFallback className="text-lg">
                        {(user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 shadow-md"
                    onClick={handleAvatarUpload}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-gray-800 dark:text-white">{user.displayName || user.username}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.plan || "Free Plan"}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    value={user.username || ""}
                    placeholder="Username"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={user.email || ""}
                    placeholder="your.email@example.com"
                    disabled
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSaveProfile}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-medium text-gray-800 dark:text-white">{user.plan || "Free Plan"}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Renewal date unavailable</p>
                </div>
                <Button variant="outline">Upgrade Plan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="ai-preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Behavior Settings</CardTitle>
              <CardDescription>
                Customize how the AI assistant responds to your queries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="ai-style">Response Style</Label>
                <Select value="balanced" onValueChange={(value) => {}}>
                  <SelectTrigger id="ai-style" className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Select a response style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise (Brief, to-the-point responses)</SelectItem>
                    <SelectItem value="balanced">Balanced (Default style)</SelectItem>
                    <SelectItem value="detailed">Detailed (Comprehensive, in-depth responses)</SelectItem>
                    <SelectItem value="simple">Simple (Explain like I'm 5)</SelectItem>
                    <SelectItem value="technical">Technical (Include technical details and jargon)</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Additional Settings</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Auto-generate summaries for documents</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Remember chat context between sessions</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Suggest follow-up questions</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Use voice input for queries (when available)</span>
                      </div>
                      <Switch />
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={() => toast({ title: "Preferences saved (Not Implemented)"})}>
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data & Privacy</CardTitle>
              <CardDescription>
                Manage your data retention and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="data-retention">Data Retention Period</Label>
                <Select value="30" onValueChange={(value) => {}}>
                  <SelectTrigger id="data-retention" className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Select retention period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Privacy Settings</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Allow usage data collection for service improvement</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Store chat history</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Share anonymous usage statistics</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                  </ul>
                </div>
                
                <div className="pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Data Management</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" size="sm">
                      Download My Data
                    </Button>
                    <Button variant="destructive" size="sm">
                      Delete All My Data
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={() => toast({ title: "Privacy settings saved (Not Implemented)"})}>
                <Save className="mr-2 h-4 w-4" />
                Save Privacy Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Email Notifications</h4>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Document processing complete</span>
                    </div>
                    <Switch 
                      checked={true}
                      onCheckedChange={(checked) => {}}
                    />
                  </li>
                  <li className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">New features and updates</span>
                    </div>
                    <Switch 
                      checked={true}
                      onCheckedChange={(checked) => {}}
                    />
                  </li>
                  <li className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">AI chat completion notifications</span>
                    </div>
                    <Switch 
                      checked={true}
                      onCheckedChange={(checked) => {}}
                    />
                  </li>
                </ul>
                
                <div className="pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">In-App Notifications</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Document processing updates</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Chat completion alerts</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                    <li className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">System announcements</span>
                      </div>
                      <Switch defaultChecked />
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={() => toast({ title: "Notification settings saved (Not Implemented)"})}>
                <Save className="mr-2 h-4 w-4" />
                Save Notifications
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}