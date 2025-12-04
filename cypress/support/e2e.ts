// Cypress support file

import "./commands";

// Hide fetch/XHR requests from command log
const app = window.top;
if (app && !app.document.head.querySelector("[data-hide-command-log-request]")) {
  const style = app.document.createElement("style");
  style.setAttribute("data-hide-command-log-request", "");
  style.innerHTML = ".command-name-request, .command-name-xhr { display: none }";
  app.document.head.appendChild(style);
}

// Global error handling
Cypress.on("uncaught:exception", (err, runnable) => {
  // Returning false prevents Cypress from failing the test on uncaught exceptions
  // that are not directly related to the test
  if (err.message.includes("ResizeObserver loop")) {
    return false;
  }
  return true;
});
