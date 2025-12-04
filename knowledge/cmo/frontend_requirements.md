# CMO Frontend Requirements

## Component Standards

### Data Fetching
All data fetching MUST use React Query hooks from `useCMO.ts`:
```typescript
// ✅ Correct
const { data: plans } = useMarketingPlans(workspaceId);

// ❌ Never fetch directly
const plans = await supabase.from('cmo_marketing_plans').select();
```

### Mutations
All mutations MUST use mutation hooks with proper cache invalidation:
```typescript
const createPlan = useCreateMarketingPlan();
await createPlan.mutateAsync({
  workspaceId,
  tenantId,
  plan_name: 'Q1 Plan',
  // ...
});
// Cache automatically invalidated via queryClient.invalidateQueries
```

### Optimistic Updates
Use `useCMOOptimistic.ts` hooks for snappy UI:
```typescript
const { updateCampaign } = useOptimisticCampaignUpdate();
updateCampaign(campaignId, { status: 'active' });
// UI updates immediately, rolls back on error
```

## Realtime Subscriptions

### Required Subscriptions
```typescript
// Agent runs - show execution status
useAgentRunsRealtime(workspaceId);

// Calendar - live schedule updates
useCalendarRealtime(workspaceId);

// Metrics - dashboard updates
useMetricsRealtime(workspaceId);
```

### Subscription Pattern
```typescript
const channel = supabase
  .channel(`cmo-${table}-${workspaceId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: table,
    filter: `workspace_id=eq.${workspaceId}`
  }, callback)
  .subscribe();
```

## Context Requirements

### CMOContext Usage
All CMO components MUST be wrapped in CMOProvider:
```typescript
<CMOProvider>
  <CMODashboard />
</CMOProvider>
```

Access context via hook:
```typescript
const { workspaceId, tenantId, currentStep } = useCMOContext();
```

## Styling Standards

### Design System
Use Tailwind semantic tokens from design system:
```typescript
// ✅ Correct - semantic tokens
className="bg-background text-foreground border-border"

// ❌ Never use direct colors
className="bg-white text-black border-gray-200"
```

### Component Library
Use shadcn/ui components:
```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
```

## Edge Function Calls

### Pattern
```typescript
const response = await supabase.functions.invoke('cmo-kernel', {
  body: {
    mode: 'strategy',
    tenant_id: tenantId,
    payload: { workspaceId, primaryGoal, budget }
  }
});
```

### Streaming
For streaming responses:
```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cmo-plan-90day`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }
);
// Process as SSE stream
```

## Error Handling

### Toast Notifications
Always show user-friendly errors:
```typescript
import { toast } from 'sonner';

try {
  await mutation.mutateAsync(data);
  toast.success('Plan created successfully');
} catch (error) {
  if (error.status === 429) {
    toast.error('Rate limit exceeded. Please try again later.');
  } else if (error.status === 402) {
    toast.error('Usage limit reached. Please add credits.');
  } else {
    toast.error('Something went wrong. Please try again.');
  }
}
```

## Lazy Loading

### Heavy Components
```typescript
const FunnelBuilder = lazy(() => import('./CMOFunnelArchitect'));

// Use with Suspense
<Suspense fallback={<Skeleton />}>
  <FunnelBuilder />
</Suspense>
```

### Preloading
```typescript
// Preload on hover/focus
onMouseEnter={() => preloadCMOComponent('funnels')}
```

## Type Safety

### Required Imports
```typescript
import type {
  BrandProfile,
  ICPSegment,
  Offer,
  MarketingPlan,
  Funnel,
  Campaign,
  ContentAsset
} from '@/lib/cmo/types';
```

### API Response Handling
```typescript
const { data } = await supabase.from('cmo_campaigns').select();
// data is typed as Campaign[] | null
```
