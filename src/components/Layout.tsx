import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Moon, Sun, User, Home, Users, DollarSign, LayoutDashboard } from "lucide-react";
import { useTheme } from "next-themes";
import Dashboard from "@/components/Dashboard";
import Properties from "@/components/Properties";
import Tenants from "@/components/Tenants";
import RentTracking from "@/components/RentTracking";
import ProfileModal from "@/components/ProfileModal";

const Layout = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["dashboard", "properties", "tenants", "rent-tracking"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  const getUserInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">RentWise</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              aria-label="Toggle theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email ? getUserInitials(user.email) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background border" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{user?.email}</p>
                </div>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setProfileModalOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>View Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full overflow-x-auto flex sm:grid sm:grid-cols-4 h-auto p-1">
            <TabsTrigger value="dashboard" className="flex-col gap-1 sm:flex-row sm:gap-2 h-auto py-2 px-3 text-xs sm:text-sm">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex-col gap-1 sm:flex-row sm:gap-2 h-auto py-2 px-3 text-xs sm:text-sm">
              <Home className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Properties</span>
            </TabsTrigger>
            <TabsTrigger value="tenants" className="flex-col gap-1 sm:flex-row sm:gap-2 h-auto py-2 px-3 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Tenants</span>
            </TabsTrigger>
            <TabsTrigger value="rent-tracking" className="flex-col gap-1 sm:flex-row sm:gap-2 h-auto py-2 px-3 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Rent Tracking</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6">
            <Dashboard />
          </TabsContent>
          
          <TabsContent value="properties" className="mt-6">
            <Properties />
          </TabsContent>
          
          <TabsContent value="tenants" className="mt-6">
            <Tenants />
          </TabsContent>
          
          <TabsContent value="rent-tracking" className="mt-6">
            <RentTracking />
          </TabsContent>
        </Tabs>
      </main>
      
      <ProfileModal 
        open={profileModalOpen} 
        onOpenChange={setProfileModalOpen} 
      />
    </div>
  );
};

export default Layout;