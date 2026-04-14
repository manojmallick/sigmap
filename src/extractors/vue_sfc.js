'use strict';

/**
 * Extract Vue Single-File Component (SFC) signatures from .vue files.
 * Captures component metadata: name, props, emits, slots, composables, lifecycle.
 *
 * @param {string} src - Raw Vue SFC content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Extract script block (both <script> and <script setup>)
  const scriptMatch = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return sigs;
  const script = scriptMatch[1];

  // Component name (from export default { name: '...' })
  const nameRe = /(?:name\s*:\s*['"`]([a-zA-Z0-9]+)['"`]|export\s+default\s+defineComponent\s*\(\s*{\s*name\s*:\s*['"`]([a-zA-Z0-9]+)['"`])/;
  const nameMatch = script.match(nameRe);
  if (nameMatch) {
    sigs.push(`component ${nameMatch[1] || nameMatch[2]}`);
  }

  // Props definition
  const propsRe = /props\s*:\s*{([^}]*)}/;
  const propsMatch = script.match(propsRe);
  if (propsMatch) {
    const propLines = propsMatch[1].split(',');
    for (const line of propLines) {
      const propName = line.trim().match(/([a-zA-Z_$]\w*)/);
      if (propName) sigs.push(`prop ${propName[1]}`);
    }
  }

  // Props in composition API (defineProps)
  const definePropsRe = /defineProps\s*(?:<([^>]+)>)?\s*\(/;
  if (definePropsRe.test(script)) {
    sigs.push('props composition-api');
  }

  // Emits definition
  const emitsRe = /emits\s*:\s*\[([^\]]+)\]/;
  const emitsMatch = script.match(emitsRe);
  if (emitsMatch) {
    const emitNames = emitsMatch[1].split(',').map(e => e.trim().replace(/['"`]/g, ''));
    for (const e of emitNames) {
      if (e) sigs.push(`emit ${e}`);
    }
  }

  // Emits in composition API (defineEmits)
  const defineEmitsRe = /defineEmits\s*(?:<([^>]+)>)?\s*\(/;
  if (defineEmitsRe.test(script)) {
    sigs.push('emits composition-api');
  }

  // Lifecycle hooks
  const lifecycleHooks = ['setup', 'created', 'mounted', 'updated', 'unmounted'];
  for (const hook of lifecycleHooks) {
    if (new RegExp(`\\b${hook}\\s*\\(`).test(script)) {
      sigs.push(`lifecycle ${hook}`);
    }
  }

  // Composable/hooks usage (useXxx)
  const composableRe = /(?:import|const)\s+(?:{[^}]*}|[a-zA-Z_$]\w*)\s+from\s+['"]/g;
  if (composableRe.test(script)) {
    const useRe = /use([A-Z]\w*)/g;
    for (const m of script.matchAll(useRe)) {
      sigs.push(`composable use${m[1]}`);
    }
  }

  // Slots definition — capture from <slot name="..."> and template slots
  const namedSlotRe = /<slot\s+name=['"]([a-zA-Z_$]\w*)['"][^>]*>/g;
  const templateSlotRe = /<template\s+#([a-zA-Z_$]\w*)|v-slot:([a-zA-Z_$]\w*)/g;
  const slots = new Set();
  
  // Named slots in template: <slot name="header">
  for (const m of src.matchAll(namedSlotRe)) {
    if (m[1]) slots.add(m[1]);
  }
  
  // Template slots with # or v-slot
  for (const m of src.matchAll(templateSlotRe)) {
    const slotName = m[1] || m[2];
    if (slotName) slots.add(slotName);
  }
  
  for (const s of slots) {
    sigs.push(`slot ${s}`);
  }

  return Array.from(new Set(sigs)).slice(0, 50);
}

module.exports = { extract };
