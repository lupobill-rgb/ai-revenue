# Revenue OS v1 Monitoring Queries

> **Purpose**: Operational monitoring for Revenue OS hardening measures  
> **Created**: 2025-12-13  
> **Status**: Active

---

## 1. Pending Acknowledgment Actions by Tenant and Subsystem

Tracks how many high-risk actions are awaiting human acknowledgment.

```sql
SELECT 
  t.name as tenant_name,
  oa.owner_subsystem,
  COUNT(*) as pending_count,
  MIN(oa.created_at) as oldest_pending
FROM optimization_actions oa
JOIN tenants t ON t.id = oa.tenant_id
WHERE oa.status = 'pending_acknowledgment'
GROUP BY t.name, oa.owner_subsystem
ORDER BY pending_count DESC;
```

**Alert threshold**: If any subsystem has > 5 pending actions or oldest_pending > 24 hours.

---

## 2. Time-to-Acknowledgment (Hours)

Measures how quickly humans respond to high-risk actions.

```sql
SELECT 
  t.name as tenant_name,
  oa.owner_subsystem,
  oa.type as action_type,
  oa.created_at,
  oa.acknowledged_at,
  EXTRACT(EPOCH FROM (oa.acknowledged_at - oa.created_at)) / 3600 as hours_to_acknowledge
FROM optimization_actions oa
JOIN tenants t ON t.id = oa.tenant_id
WHERE oa.acknowledged_at IS NOT NULL
ORDER BY oa.acknowledged_at DESC
LIMIT 50;
```

**Target**: < 4 hours median time-to-acknowledgment during business hours.

---

## 3. Time-to-Execution (Hours)

Measures total lifecycle from action creation to completion.

```sql
SELECT 
  t.name as tenant_name,
  oa.owner_subsystem,
  oa.type as action_type,
  oa.created_at,
  oa.executed_at,
  EXTRACT(EPOCH FROM (oa.executed_at - oa.created_at)) / 3600 as hours_to_execute
FROM optimization_actions oa
JOIN tenants t ON t.id = oa.tenant_id
WHERE oa.status = 'completed'
ORDER BY oa.executed_at DESC
LIMIT 50;
```

---

## 4. Context Snapshot Coverage

Verifies all completed actions have audit trail.

```sql
SELECT 
  COUNT(*) FILTER (WHERE oar.context_snapshot IS NOT NULL) as with_snapshot,
  COUNT(*) FILTER (WHERE oar.context_snapshot IS NULL) as without_snapshot,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE oar.context_snapshot IS NOT NULL) / 
    NULLIF(COUNT(*), 0), 
    1
  ) as coverage_pct
FROM optimization_actions oa
JOIN optimization_action_results oar ON oar.optimization_action_id = oa.id
WHERE oa.status = 'completed';
```

**Target**: 100% coverage - any action without snapshot indicates executor bug.

---

## 5. CFO Gates Triggered This Week

Shows how often economic constraints are blocking scale actions.

```sql
SELECT 
  t.name as tenant_name,
  oc.cycle_id,
  oc.invoked_at,
  oc.cfo_gates_active,
  array_length(oc.cfo_gates_active, 1) as gates_count
FROM optimization_cycles oc
JOIN tenants t ON t.id = oc.tenant_id
WHERE oc.invoked_at >= NOW() - INTERVAL '7 days'
  AND oc.cfo_gates_active IS NOT NULL
  AND array_length(oc.cfo_gates_active, 1) > 0
ORDER BY oc.invoked_at DESC;
```

---

## 6. Actions by Status (7-day summary)

High-level health check of the action pipeline.

```sql
SELECT 
  oa.status,
  COUNT(*) as action_count
FROM optimization_actions oa
WHERE oa.created_at >= NOW() - INTERVAL '7 days'
GROUP BY oa.status
ORDER BY action_count DESC;
```

---

## 7. Tenant Activation Status

Verifies which tenants are within 30-day acknowledgment window.

```sql
SELECT 
  t.id,
  t.name,
  t.revenue_os_enabled,
  t.revenue_os_activated_at,
  t.cfo_expansion_enabled,
  EXTRACT(DAY FROM (NOW() - t.revenue_os_activated_at)) as days_since_activation,
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - t.revenue_os_activated_at)) <= 30 
    THEN 'Within 30-day gate window'
    ELSE 'Auto-execution eligible'
  END as acknowledgment_mode
FROM tenants t
WHERE t.status = 'active' AND t.revenue_os_enabled = true
ORDER BY t.revenue_os_activated_at;
```

---

## Dashboard Implementation

These queries should be exposed in a monitoring dashboard with:
- Real-time refresh (5-minute intervals)
- Alert badges for threshold violations
- Historical trends (7-day, 30-day views)
