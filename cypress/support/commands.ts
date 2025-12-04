// Custom Cypress commands

// Login command with session caching
Cypress.Commands.add("loginAs", (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      cy.visit("/login");
      cy.get('input[type="email"]').type(email);
      cy.get('input[type="password"]').type(password);
      cy.get('button[type="submit"]').click();
      cy.url().should("include", "/dashboard");
    },
    {
      validate: () => {
        // Validate session is still active
        cy.window().its("localStorage").invoke("getItem", "supabase.auth.token").should("exist");
      },
    }
  );
});

// Wait for API response
Cypress.Commands.add("waitForApi", (alias: string, timeout = 10000) => {
  cy.wait(alias, { timeout });
});

// Select from dropdown (works with shadcn Select)
Cypress.Commands.add("selectOption", (selector: string, optionText: string) => {
  cy.get(selector).click();
  cy.contains('[role="option"]', optionText).click();
});

// Fill form field with label
Cypress.Commands.add("fillField", (label: string, value: string) => {
  cy.contains("label", label).parent().find("input, textarea").clear().type(value);
});

// Assert toast message
Cypress.Commands.add("shouldShowToast", (message: string) => {
  cy.get('[data-sonner-toast]').should("contain", message);
});

// Intercept CMO API calls
Cypress.Commands.add("interceptCMOApi", (endpoint: string, alias: string, fixture?: string) => {
  const url = `${Cypress.env("API_URL")}/${endpoint}`;
  if (fixture) {
    cy.intercept("POST", url, { fixture }).as(alias);
  } else {
    cy.intercept("POST", url).as(alias);
  }
});

// Type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(email: string, password: string): Chainable<void>;
      waitForApi(alias: string, timeout?: number): Chainable<void>;
      selectOption(selector: string, optionText: string): Chainable<void>;
      fillField(label: string, value: string): Chainable<void>;
      shouldShowToast(message: string): Chainable<void>;
      interceptCMOApi(endpoint: string, alias: string, fixture?: string): Chainable<void>;
    }
  }
}

export {};
