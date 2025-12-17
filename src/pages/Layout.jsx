

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import {
  FolderPlus,
  Spline,
  Database,
  BarChart3,
  Settings,
  Orbit,
  Package // Added Package icon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger } from
"@/components/ui/sidebar";

const navigationItems = [
{
  title: "Dashboard",
  url: createPageUrl("Dashboard"),
  icon: BarChart3
},
{
  title: "Projects",
  url: createPageUrl("Projects"),
  icon: FolderPlus
},
{
  title: "Build Variants", // New navigation item
  url: createPageUrl("BuildVariants"),
  icon: Package
},
{
  title: "Model Training",
  url: createPageUrl("TrainingConfiguration"),
  icon: Spline
},
{
  title: "Label Library",
  url: createPageUrl("LabelLibrary"),
  icon: Database
},
{
  title: "Results & Analysis",
  url: createPageUrl("ResultsAndAnalysis"),
  icon: BarChart3
},
{
  title: "Settings",
  url: createPageUrl("Settings"),
  icon: Settings
}];


export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, []);

  // Hide sidebar for Annotation Studio page
  const isAnnotationStudio = currentPageName === "AnnotationStudio" || location.pathname.includes("AnnotationStudio") || currentPageName === "AnnotationReview";

  if (isAnnotationStudio) {
    return (
      <div className="min-h-screen w-full">
        {children}
      </div>);

  }

  return (
    <SidebarProvider>
      <style>
        {`
          :root {
            --primary-blue: #014ECB;
            --primary-blue-light: #3481FE;
            --primary-blue-lighter: #CCE0FF;
            --primary-blue-lightest: #EFF5FF;
            --soft-blue: #f8fafc;
            --border-blue: #CCE0FF;
            --accent-blue: #0162FE;
            --text-muted: #64748b;
            --success-green: #10b981;
            --warning-amber: #f59e0b;
          }
          
          .glass-effect {
            backdrop-filter: blur(12px);
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(204, 224, 255, 0.6);
          }
          
          .gradient-bg {
            background: linear-gradient(135deg, #EFF5FF 0%, #CCE0FF 100%);
          }
        `}
      </style>
      
      <div className="min-h-screen flex w-full gradient-bg">
        <Sidebar className="border-r border-blue-200/60 glass-effect flex flex-col">
          <SidebarHeader className="border-b border-blue-200/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-white">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/067a9f53a_Android.png" 
                  alt="SaturnOS Logo"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">SaturnOS 2.0</h2>
                <p className="text-xs text-gray-500 font-medium">Guided LLM Annotation</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-3">
                Workspace
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) =>
                  <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                      asChild
                      className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-300 rounded-xl mb-1 ${
                      location.pathname === item.url ?
                      'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' :
                      'text-gray-600'}`
                      }>

                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-blue-200/60 p-0">
            <Link to={createPageUrl("Settings")} className="block hover:bg-blue-50/50 p-6 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {user ? user.full_name?.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {user ? user.full_name : 'Loading...'}
                    </p>
                    <p className="text-xs text-gray-500 truncate capitalize">
                      {user ? user.role : 'User'}
                    </p>
                  </div>
                </div>
            </Link>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/70 backdrop-blur-sm border-b border-blue-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-blue-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900">SaturnOS 2.0</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

