-- Attach triggers for CRM stage tracking (functions already exist)

-- Trigger: When a deal's stage changes to closed_won/closed_lost, set timestamps
CREATE OR REPLACE TRIGGER trg_deal_status_timestamps
  BEFORE UPDATE ON deals
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION fn_deal_status_timestamps();
-- Trigger: When a lead's status changes, record a stage event
CREATE OR REPLACE TRIGGER trg_lead_stage_event
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_lead_stage_event();
-- Trigger: Set tenant_id and data_mode on deal insert
CREATE OR REPLACE TRIGGER trg_deal_set_tenant_mode
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION set_deal_tenant_and_mode();
