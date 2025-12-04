/**
 * Kernel Module Registry
 * Registers all available modules with the OS kernel
 */

import { registerModule } from '../core';
import cmoManifest from '../../registry/modules/cmo.manifest.json';

// Register CMO module
registerModule(cmoManifest);

// Re-export for convenience
export { cmoManifest };
export * from '../core';
