import {
  BarChart3,
  BadgeDollarSign,
  CreditCard,
  Database,
  FolderPlus,
  Package,
  Settings,
  Spline,
} from "lucide-react";

// Default feature visibility per page; admin sees all.
export const defaultFeatureVisibility = {
  dashboard: true,
  projects: true,
  buildVariants: true,
  training: true,
  labelLibrary: true,
  results: true,
  settings: true,
  pricing: true,
  billing: true,
};

export const navigationItems = [
  {
    title: "Dashboard",
    page: "Dashboard",
    icon: BarChart3,
    featureKey: "dashboard",
  },
  {
    title: "Projects",
    page: "Projects",
    icon: FolderPlus,
    featureKey: "projects",
  },
  {
    title: "Build Variants",
    page: "BuildVariants",
    icon: Package,
    featureKey: "buildVariants",
  },
  {
    title: "Model Training",
    page: "TrainingConfiguration",
    icon: Spline,
    featureKey: "training",
  },
  {
    title: "Label Library",
    page: "LabelLibrary",
    icon: Database,
    featureKey: "labelLibrary",
  },
  {
    title: "Results & Analysis",
    page: "ResultsAndAnalysis",
    icon: BarChart3,
    featureKey: "results",
  },
  {
    title: "Pricing",
    page: "Pricing",
    icon: BadgeDollarSign,
    featureKey: "pricing",
  },
  {
    title: "Billing & Usage",
    page: "Billing",
    icon: CreditCard,
    featureKey: "billing",
  },
  {
    title: "Settings",
    page: "Settings",
    icon: Settings,
    featureKey: "settings",
  },
];
