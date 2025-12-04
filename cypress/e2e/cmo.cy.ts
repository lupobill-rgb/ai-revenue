// Cypress E2E Test Suite for CMO Module

describe("CMO Dashboard E2E", () => {
  beforeEach(() => {
    // Login before each test
    cy.visit("/login");
    cy.get('input[type="email"]').type("test@example.com");
    cy.get('input[type="password"]').type("testpassword123");
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/dashboard");
  });

  describe("Brand Intake Flow", () => {
    it("should complete brand intake wizard", () => {
      cy.visit("/cmo/brand-intake");
      
      // Step 1: Brand basics
      cy.get('[data-testid="brand-name-input"]').type("Test Company");
      cy.get('[data-testid="brand-tagline-input"]').type("Innovation Made Simple");
      cy.get('[data-testid="industry-select"]').click();
      cy.contains("Technology").click();
      cy.get('[data-testid="next-step-btn"]').click();

      // Step 2: Brand voice
      cy.get('[data-testid="brand-voice-select"]').click();
      cy.contains("Professional").click();
      cy.get('[data-testid="brand-tone-select"]').click();
      cy.contains("Confident").click();
      cy.get('[data-testid="next-step-btn"]').click();

      // Step 3: ICP definition
      cy.get('[data-testid="icp-segment-name"]').type("Enterprise Tech Leaders");
      cy.get('[data-testid="icp-pain-points"]').type("Scaling challenges\nLegacy systems");
      cy.get('[data-testid="next-step-btn"]').click();

      // Step 4: Offers
      cy.get('[data-testid="offer-name"]').type("Enterprise Platform");
      cy.get('[data-testid="offer-description"]').type("Complete enterprise solution");
      cy.get('[data-testid="complete-btn"]').click();

      // Verify completion
      cy.contains("Brand profile created").should("be.visible");
    });
  });

  describe("90-Day Plan Generation", () => {
    it("should generate and display marketing plan", () => {
      cy.visit("/cmo/planner");

      // Fill plan parameters
      cy.get('[data-testid="plan-objective"]').type("Increase MQLs by 50%");
      cy.get('[data-testid="plan-budget"]').type("50000");
      cy.get('[data-testid="select-icp"]').click();
      cy.contains("Enterprise Tech Leaders").click();

      // Generate plan
      cy.get('[data-testid="generate-plan-btn"]').click();

      // Wait for AI generation (with loading indicator)
      cy.get('[data-testid="plan-loading"]').should("be.visible");
      cy.get('[data-testid="plan-loading"]', { timeout: 30000 }).should("not.exist");

      // Verify plan structure
      cy.get('[data-testid="plan-month-1"]').should("be.visible");
      cy.get('[data-testid="plan-month-2"]').should("be.visible");
      cy.get('[data-testid="plan-month-3"]').should("be.visible");

      // Check milestones exist
      cy.get('[data-testid="plan-milestones"]').find("li").should("have.length.at.least", 3);
    });

    it("should allow plan editing", () => {
      cy.visit("/cmo/planner");
      
      // Select existing plan
      cy.get('[data-testid="plan-list"]').find('[data-testid="plan-item"]').first().click();
      
      // Edit mode
      cy.get('[data-testid="edit-plan-btn"]').click();
      cy.get('[data-testid="plan-objective"]').clear().type("Updated objective");
      cy.get('[data-testid="save-plan-btn"]').click();

      // Verify save
      cy.contains("Plan updated").should("be.visible");
    });
  });

  describe("Funnel Builder", () => {
    it("should create and configure funnel stages", () => {
      cy.visit("/cmo/funnels");

      // Create new funnel
      cy.get('[data-testid="new-funnel-btn"]').click();
      cy.get('[data-testid="funnel-name"]').type("Lead Gen Funnel Q1");
      cy.get('[data-testid="funnel-type-select"]').click();
      cy.contains("Lead Generation").click();

      // Add stages
      cy.get('[data-testid="add-stage-btn"]').click();
      cy.get('[data-testid="stage-name-0"]').type("Awareness");
      cy.get('[data-testid="stage-type-0"]').select("awareness");

      cy.get('[data-testid="add-stage-btn"]').click();
      cy.get('[data-testid="stage-name-1"]').type("Consideration");
      cy.get('[data-testid="stage-type-1"]').select("consideration");

      cy.get('[data-testid="add-stage-btn"]').click();
      cy.get('[data-testid="stage-name-2"]').type("Conversion");
      cy.get('[data-testid="stage-type-2"]').select("conversion");

      // Save funnel
      cy.get('[data-testid="save-funnel-btn"]').click();
      cy.contains("Funnel created").should("be.visible");

      // Verify funnel appears in list
      cy.get('[data-testid="funnel-list"]').contains("Lead Gen Funnel Q1");
    });

    it("should drag and reorder funnel stages", () => {
      cy.visit("/cmo/funnels");
      cy.get('[data-testid="funnel-list"]').find('[data-testid="funnel-item"]').first().click();

      // Drag stage 2 to position 1
      cy.get('[data-testid="stage-1"]')
        .trigger("dragstart")
        .trigger("dragleave");

      cy.get('[data-testid="stage-0"]')
        .trigger("dragenter")
        .trigger("dragover")
        .trigger("drop");

      cy.get('[data-testid="stage-1"]').trigger("dragend");

      // Save and verify order changed
      cy.get('[data-testid="save-funnel-btn"]').click();
      cy.contains("Funnel updated").should("be.visible");
    });
  });

  describe("Campaign Management", () => {
    it("should create and launch campaign", () => {
      cy.visit("/cmo/campaigns");

      // Create campaign
      cy.get('[data-testid="new-campaign-btn"]').click();
      cy.get('[data-testid="campaign-name"]').type("Product Launch Campaign");
      cy.get('[data-testid="campaign-type"]').select("product_launch");
      cy.get('[data-testid="select-funnel"]').click();
      cy.contains("Lead Gen Funnel").click();

      // Add channels
      cy.get('[data-testid="add-channel-btn"]').click();
      cy.get('[data-testid="channel-select-0"]').click();
      cy.contains("Email").click();

      cy.get('[data-testid="add-channel-btn"]').click();
      cy.get('[data-testid="channel-select-1"]').click();
      cy.contains("LinkedIn").click();

      // Set dates
      cy.get('[data-testid="start-date"]').type("2025-01-15");
      cy.get('[data-testid="end-date"]').type("2025-03-15");

      // Save as draft
      cy.get('[data-testid="save-draft-btn"]').click();
      cy.contains("Campaign saved").should("be.visible");

      // Launch campaign
      cy.get('[data-testid="launch-campaign-btn"]').click();
      cy.get('[data-testid="confirm-launch-btn"]').click();
      cy.contains("Campaign launched").should("be.visible");
    });

    it("should show campaign analytics", () => {
      cy.visit("/cmo/campaigns");
      cy.get('[data-testid="campaign-list"]').find('[data-testid="campaign-item"]').first().click();
      
      // Verify analytics section
      cy.get('[data-testid="campaign-analytics"]').should("be.visible");
      cy.get('[data-testid="metric-impressions"]').should("be.visible");
      cy.get('[data-testid="metric-clicks"]').should("be.visible");
      cy.get('[data-testid="metric-conversions"]').should("be.visible");
    });
  });

  describe("Content Generation", () => {
    it("should generate content for campaign", () => {
      cy.visit("/cmo/campaigns");
      cy.get('[data-testid="campaign-list"]').find('[data-testid="campaign-item"]').first().click();
      
      // Navigate to content tab
      cy.get('[data-testid="content-tab"]').click();
      
      // Generate content
      cy.get('[data-testid="generate-content-btn"]').click();
      cy.get('[data-testid="content-type-select"]').click();
      cy.contains("Email Sequence").click();
      cy.get('[data-testid="generate-btn"]').click();

      // Wait for generation
      cy.get('[data-testid="generating-indicator"]', { timeout: 30000 }).should("not.exist");

      // Verify content created with variants
      cy.get('[data-testid="content-list"]').find('[data-testid="content-item"]').should("have.length.at.least", 1);
      cy.get('[data-testid="content-item"]').first().click();
      cy.get('[data-testid="variant-list"]').find('[data-testid="variant-item"]').should("have.length.at.least", 2);
    });
  });

  describe("Agent Console", () => {
    it("should execute agent and show history", () => {
      cy.visit("/cmo/console");

      // Select agent mode
      cy.get('[data-testid="agent-mode-select"]').click();
      cy.contains("Content Engine").click();

      // Enter prompt
      cy.get('[data-testid="agent-prompt"]').type("Generate 3 social media posts for product awareness");

      // Run agent
      cy.get('[data-testid="run-agent-btn"]').click();

      // Wait for completion
      cy.get('[data-testid="agent-loading"]').should("be.visible");
      cy.get('[data-testid="agent-loading"]', { timeout: 30000 }).should("not.exist");

      // Verify response
      cy.get('[data-testid="agent-response"]').should("be.visible");

      // Check history updated
      cy.get('[data-testid="agent-history"]')
        .find('[data-testid="history-item"]')
        .first()
        .should("contain", "Content Engine");
    });
  });

  describe("Recommendations", () => {
    it("should display and implement recommendations", () => {
      cy.visit("/cmo/recommendations");

      // Verify recommendations loaded
      cy.get('[data-testid="recommendations-list"]')
        .find('[data-testid="recommendation-item"]')
        .should("have.length.at.least", 1);

      // View recommendation details
      cy.get('[data-testid="recommendation-item"]').first().click();
      cy.get('[data-testid="recommendation-detail"]').should("be.visible");

      // Implement recommendation
      cy.get('[data-testid="implement-btn"]').click();
      cy.contains("Recommendation implemented").should("be.visible");

      // Verify status changed
      cy.get('[data-testid="recommendation-item"]').first().should("contain", "Implemented");
    });
  });
});

// Custom Cypress commands
Cypress.Commands.add("loginAs", (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/dashboard");
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(email: string, password: string): Chainable<void>;
    }
  }
}

export {};
