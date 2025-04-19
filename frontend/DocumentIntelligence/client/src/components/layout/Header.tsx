import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";
import { useDocuments } from "@/hooks/useDocuments";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { LogOut, Menu, Moon, Search, Settings, Sun, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  toggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function Header({ toggleSidebar, sidebarOpen }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useDocuments();
  const { logoutMutation } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="z-10 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/10 backdrop-blur-lg dark:bg-gray-900/70 shadow-sm">
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar} 
          className="lg:hidden text-gray-500 hover:text-primary focus:outline-none"
          aria-label="Toggle sidebar"
          data-sidebar-toggle
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 mr-2 text-primary">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white font-display">DocuMind AI</h1>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        {searchOpen ? (
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Search..." 
              className="py-2 pl-3 pr-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-64 text-sm"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-0" 
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSearchOpen(true)} 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 shadow-sm text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary"
          >
            <Search className="h-5 w-5" />
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 shadow-sm text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full p-0 border-none focus-visible:ring-0 focus-visible:ring-offset-0">
              <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                {currentUser?.image ? (
                  <AvatarImage src={currentUser.image} alt={currentUser.name || currentUser.displayName || 'User Avatar'} />
                ) : (
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {currentUser?.name?.charAt(0) || currentUser?.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{currentUser?.name || currentUser?.displayName || currentUser?.username}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser?.plan || "Free Plan"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
