// CMO Lazy-loaded Components

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Component Props types
interface CMOFunnelArchitectProps {
  workspaceId: string;
  planId?: string;
  onFunnelSaved?: () => void;
}

interface CMO90DayPlannerProps {
  workspaceId: string;
  onPlanSaved?: () => void;
}

interface CMOBrandIntakeProps {
  workspaceId: string;
  onComplete?: () => void;
}

// Loading fallback component
function ComponentLoader({ name }: { name: string }) {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading {name}...</p>
    </div>
  );
}

// Placeholder component for components not yet created
function PlaceholderComponent({ name }: { name: string }) {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50">
      <p className="text-sm text-muted-foreground">{name} component coming soon</p>
    </div>
  );
}

// Heavy CMO components - lazy loaded with named exports
const LazyFunnelBuilder = lazy(() =>
  import("@/components/cmo/CMOFunnelArchitect").then((mod) => ({
    default: mod.CMOFunnelArchitect,
  }))
);

const Lazy90DayPlanner = lazy(() =>
  import("@/components/cmo/CMO90DayPlanner").then((mod) => ({
    default: mod.CMO90DayPlanner,
  }))
);

const LazyBrandIntake = lazy(() =>
  import("@/components/cmo/CMOBrandIntake").then((mod) => ({
    default: mod.CMOBrandIntake,
  }))
);

// Wrapper components with Suspense and proper typing
export function SuspenseFunnelBuilder(props: CMOFunnelArchitectProps) {
  return (
    <Suspense fallback={<ComponentLoader name="Funnel Builder" />}>
      <LazyFunnelBuilder {...props} />
    </Suspense>
  );
}

export function Suspense90DayPlanner(props: CMO90DayPlannerProps) {
  return (
    <Suspense fallback={<ComponentLoader name="90-Day Planner" />}>
      <Lazy90DayPlanner {...props} />
    </Suspense>
  );
}

export function SuspenseBrandIntake(props: CMOBrandIntakeProps) {
  return (
    <Suspense fallback={<ComponentLoader name="Brand Intake" />}>
      <LazyBrandIntake {...props} />
    </Suspense>
  );
}

// Placeholder lazy components for future implementation
export function LazyCMOAnalytics() {
  return <PlaceholderComponent name="CMO Analytics" />;
}

export function LazyCMOCalendar() {
  return <PlaceholderComponent name="CMO Calendar" />;
}

export function LazyCMOCampaigns() {
  return <PlaceholderComponent name="CMO Campaigns" />;
}

// Preload function for route-based prefetching
export function preloadCMOComponent(
  component: "funnel" | "planner" | "brand" | "analytics" | "calendar" | "campaigns"
) {
  const loaders: Record<string, () => Promise<unknown>> = {
    funnel: () => import("@/components/cmo/CMOFunnelArchitect"),
    planner: () => import("@/components/cmo/CMO90DayPlanner"),
    brand: () => import("@/components/cmo/CMOBrandIntake"),
    // These will be implemented later
    analytics: () => Promise.resolve({}),
    calendar: () => Promise.resolve({}),
    campaigns: () => Promise.resolve({}),
  };

  const loader = loaders[component];
  if (loader) {
    loader();
  }
}

// Hook for prefetching on hover/focus
export function usePrefetch() {
  const prefetch = (component: Parameters<typeof preloadCMOComponent>[0]) => {
    // Use requestIdleCallback if available for non-blocking prefetch
    if ("requestIdleCallback" in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
        () => preloadCMOComponent(component)
      );
    } else {
      setTimeout(() => preloadCMOComponent(component), 100);
    }
  };

  return { prefetch };
}

// Re-export lazy components for direct use
export { LazyFunnelBuilder, Lazy90DayPlanner, LazyBrandIntake };
