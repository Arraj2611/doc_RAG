import { useState, useEffect } from "react";
import { useDocuments } from "@/hooks/useDocuments";
import { motion } from "framer-motion";
import { UserType } from "@/types";
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
import { preferencesApi } from "@/lib/api-client";

export default function ProfileSettings() {
  const { currentUser } = useDocuments();
  const [profile, setProfile] = useState<UserType | null>(currentUser);
  const [aiResponseStyle, setAiResponseStyle] = useState("balanced");
  const [dataRetention, setDataRetention] = useState("30");
  const [notifications, setNotifications] = useState({
    documentProcessed: true,
    newFeatures: true,
    chatCompletion: false
  });
  const { toast } = useToast();

  // Load user's system prompt preference on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (currentUser?.id) {
        try {
          const response = await preferencesApi.getSystemPrompt(currentUser.id.toString());
          if (response.data && response.data.response_style) {
            setAiResponseStyle(response.data.response_style);
          }
        } catch (error) {
          console.error("Failed to load preferences:", error);
          // Use default value
        }
      }
    };
    
    loadPreferences();
  }, [currentUser]);

  const handleSaveProfile = () => {
    toast({
      title: "Profile updated",
      description: "Your profile settings have been saved successfully.",
    });
  };

  const handleSaveAIPreferences = async () => {
    if (!currentUser?.id) {
      toast({
        title: "Error",
        description: "User not found. Please login again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await preferencesApi.updateSystemPrompt(currentUser.id.toString(), aiResponseStyle);
      
      toast({
        title: "AI Preferences saved",
        description: "Your AI response style has been updated successfully.",
      });
    } catch (error) {
      console.error("Failed to save AI preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save AI preferences. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = () => {
    // This would usually open a file picker and handle the upload
    toast({
      title: "Feature not implemented",
      description: "Avatar upload would be implemented in a production version.",
    });
  };

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
        
        {/* Profile Tab */}
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
                    <AvatarFallback className="text-lg">
                      {profile?.username?.charAt(0) || "U"}
                    </AvatarFallback>
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
                  <h3 className="font-medium text-gray-800 dark:text-white">{profile?.displayName || profile?.username}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profile?.plan}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input 
                    id="name" 
                    value={profile?.displayName || ""}
                    onChange={(e) => setProfile(profile ? { ...profile, displayName: e.target.value } : null)}
                    placeholder="Enter your display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    value={profile?.username || ""}
                    disabled
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={profile?.email || ""}
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
                  <h3 className="font-medium text-gray-800 dark:text-white">{profile?.plan}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Renews on April 15, 2023</p>
                </div>
                <Button variant="outline">Upgrade Plan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* AI Preferences Tab */}
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
                <Select value={aiResponseStyle} onValueChange={setAiResponseStyle}>
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
              <Button onClick={handleSaveAIPreferences}>
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Privacy Tab */}
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
                <Select value={dataRetention} onValueChange={setDataRetention}>
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
              <Button onClick={handleSaveProfile}>
                <Save className="mr-2 h-4 w-4" />
                Save Privacy Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Notifications Tab */}
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
                      checked={notifications.documentProcessed}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({...prev, documentProcessed: checked}))
                      }
                    />
                  </li>
                  <li className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">New features and updates</span>
                    </div>
                    <Switch 
                      checked={notifications.newFeatures}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({...prev, newFeatures: checked}))
                      }
                    />
                  </li>
                  <li className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">AI chat completion notifications</span>
                    </div>
                    <Switch 
                      checked={notifications.chatCompletion}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({...prev, chatCompletion: checked}))
                      }
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
              <Button onClick={handleSaveProfile}>
                <Save className="mr-2 h-4 w-4" />
                Save Notification Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}