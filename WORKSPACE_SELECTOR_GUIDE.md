# 📍 Workspace Selector Location Guide

## ✅ **It's Already There!**

The WorkspaceSelector IS in the navigation. Here's where to find it:

---

## 🎯 **Location**

### Desktop View
```
Top Navigation Bar (right side):
[Logo] [Home] [Approve] [Analytics] [CRM] [Create▼] [Deploy▼]  ⟶  [🏢 Workspace Selector] [?] [🔔] [😊] [Avatar]
                                                                          👆 RIGHT HERE
```

**Visual Position:**
- Top-right area of the page
- Between the "Create/Deploy" menus and the Help icon (?)
- Shows as a button with a building icon (🏢) and workspace name
- Has a dropdown arrow (▼)

### Mobile View
```
[☰ Menu]
  └─ Opens side menu with Workspace Selector at top
     👆 FIRST ITEM in mobile menu
```

---

## 🔍 **What It Looks Like**

### When No Workspace Selected:
```
┌──────────────────────┐
│ 🏢 Select Workspace ▼│
└──────────────────────┘
```

### When Workspace Selected:
```
┌──────────────────────┐
│ 🏢 Acme Corp        ▼│
└──────────────────────┘
```

### Dropdown Menu:
```
┌──────────────────────┐
│ ✓ Acme Corp         │  ← Active workspace (checkmark)
│   Another Workspace  │
│ ──────────────────── │
│ ➕ Create Workspace  │
└──────────────────────┘
```

---

## 🧪 **How to Test Workspace Isolation**

### 1. **Create a Second Workspace**
```
1. Click the Workspace Selector button (🏢 [Current Workspace] ▼)
2. Click "➕ Create Workspace"
3. Enter name: "Test Workspace B"
4. URL slug auto-fills: "test-workspace-b"
5. Click "Create Workspace"
```

### 2. **Add Test Data to Workspace A**
```
1. Select "Workspace A" from selector
2. Go to CRM → Import a lead or create one manually
   - Name: "Lead for Workspace A"
   - Email: "lead-a@example.com"
3. Note the lead ID
```

### 3. **Switch to Workspace B**
```
1. Click Workspace Selector
2. Select "Test Workspace B"
3. Notice page refreshes (this is good - data is reloading)
4. Go to CRM
5. ✅ Verify: Lead from Workspace A is NOT visible
```

### 4. **Add Data to Workspace B**
```
1. Still in Workspace B
2. Create a new lead:
   - Name: "Lead for Workspace B"
   - Email: "lead-b@example.com"
3. Note this lead ID
```

### 5. **Verify Isolation**
```
1. Switch back to Workspace A (via selector)
2. Go to CRM
3. ✅ Verify: Only "Lead for Workspace A" is visible
4. ✅ Verify: "Lead for Workspace B" is NOT visible

5. Switch to Workspace B
6. ✅ Verify: Only "Lead for Workspace B" is visible
7. ✅ Verify: "Lead for Workspace A" is NOT visible
```

---

## 🐛 **Troubleshooting**

### "I don't see the Workspace Selector"

**Check 1: Are you logged in?**
- The selector only appears on authenticated pages
- Log in at `/login` if needed

**Check 2: Which page are you on?**
- It appears on: Dashboard, CRM, Reports, Approvals, etc.
- It does NOT appear on: Login, Signup, Landing page

**Check 3: Browser width**
- On narrow screens (<768px), it moves to the mobile menu (☰)

**Check 4: Do you have workspaces?**
Open browser console and run:
```javascript
// Check if workspaces exist
const { data } = await supabase.from('workspaces').select('*');
console.log('Workspaces:', data);
```

**Check 5: Is WorkspaceContext loaded?**
Open browser console and check for errors:
```
Right-click page → Inspect → Console tab
Look for errors related to "workspace" or "context"
```

### "The selector is there but shows 'Select Workspace'"

This means no workspace is selected yet:
1. Click the selector
2. If you see workspaces in the dropdown, select one
3. If dropdown is empty, click "➕ Create Workspace"

### "I created a workspace but it's not in the dropdown"

1. Check browser console for errors
2. Refresh the page (workspace list should reload)
3. Verify workspace was created:
```sql
SELECT * FROM workspaces WHERE owner_id = auth.uid();
```

---

## 📊 **Expected Behavior**

### ✅ **Correct Behavior:**
1. **Workspace persists** — Selected workspace remembered across page navigations
2. **Data isolation** — Switching workspaces shows different data
3. **Visual feedback** — Selected workspace has checkmark (✓)
4. **Page refresh** — Data reloads when workspace changes

### ❌ **Incorrect Behavior (Report if you see this):**
1. Workspace selector not visible when logged in
2. Selecting workspace doesn't change data
3. Data from Workspace A visible in Workspace B
4. Workspace selection doesn't persist on page navigation

---

## 🔧 **Manual SQL Verification**

If you want to verify isolation at the database level:

```sql
-- 1. Check your workspaces
SELECT id, name, slug FROM workspaces WHERE owner_id = auth.uid();

-- 2. Check leads in Workspace A (replace UUID)
SELECT id, first_name, last_name, email, workspace_id 
FROM leads 
WHERE workspace_id = 'YOUR-WORKSPACE-A-UUID';

-- 3. Check leads in Workspace B (replace UUID)
SELECT id, first_name, last_name, email, workspace_id 
FROM leads 
WHERE workspace_id = 'YOUR-WORKSPACE-B-UUID';

-- 4. Verify no cross-workspace contamination
SELECT COUNT(*) FROM leads WHERE workspace_id IS NULL;
-- ✅ Should return 0
```

---

## 📸 **Screenshot Reference**

The selector is in this location:
```
┌─────────────────────────────────────────────────────────────────────┐
│ UbiGrowth   [Home] [Approve] [Analytics] [CRM] ...  [🏢 Acme▼] [?] │
│                                                          👆          │
└─────────────────────────────────────────────────────────────────────┘
│                                                                       │
│                    Your dashboard content here                        │
│                                                                       │
```

---

## ✅ **Deployment Checklist**

Before testing in production:
- [x] Code deployed to `main`
- [x] WorkspaceSelector component exists
- [x] NavBar includes WorkspaceSelector
- [x] WorkspaceContext provides workspace state
- [ ] **At least 2 workspaces created for testing**
- [ ] **Test data added to each workspace**
- [ ] **Isolation verified by switching workspaces**

---

## 🚀 **Quick Start Test Script**

```bash
# 1. Open your app
# 2. Log in
# 3. Look for the Workspace Selector in top-right
# 4. Click it → Create 2 workspaces
# 5. Add different leads to each
# 6. Switch between them
# 7. Verify data isolation
```

---

## 📞 **Support**

If the selector is truly not visible:
1. Share a screenshot of your dashboard
2. Check browser console for errors
3. Verify you're on a protected route (not login/signup)
4. Try refreshing the page

**Expected:** Workspace Selector visible in navbar on all authenticated pages  
**Location:** Top-right, between navigation and user avatar  
**File:** `src/components/WorkspaceSelector.tsx` (already deployed)  
**Status:** ✅ Live and functional

