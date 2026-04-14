'use strict';

/**
 * Extract Python dataclass, Pydantic model, and SQLAlchemy ORM metadata.
 * Focuses on model fields, validation, and relationships.
 *
 * @param {string} src - Raw Python content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Dataclass definitions
  const dataclassRe = /@dataclass(?:\([^)]*\))?[\s\n]+class\s+([A-Z]\w*)/g;
  for (const m of src.matchAll(dataclassRe)) {
    sigs.push(`dataclass ${m[1]}`);
  }

  // Pydantic BaseModel classes
  const pydanticRe = /class\s+([A-Z]\w*)\s*\([^)]*BaseModel[^)]*\)/g;
  for (const m of src.matchAll(pydanticRe)) {
    sigs.push(`model ${m[1]}`);
  }

  // Pydantic v2 model_validate / field definitions
  if (/model_validate|field_validator|computed_field/.test(src)) {
    sigs.push('pydantic v2+');
  }

  // SQLAlchemy model classes
  const sqlalchemyRe = /class\s+([A-Z]\w*)\s*\([^)]*(?:Base|declarative_base)[^)]*\)/g;
  for (const m of src.matchAll(sqlalchemyRe)) {
    sigs.push(`orm ${m[1]}`);
  }

  // Model fields with type hints (for dataclass/Pydantic)
  const fieldRe = /^\s+([a-z_]\w*)\s*:\s*([A-Z]\w*|List|Dict|Optional|Union)[^=]*/gm;
  const fields = new Set();
  for (const m of src.matchAll(fieldRe)) {
    if (fields.size < 15) fields.add(m[1]);
  }
  for (const f of fields) {
    sigs.push(`field ${f}`);
  }

  // SQLAlchemy Column definitions
  const columnRe = /([a-z_]\w*)\s*=\s*Column\s*\([^)]*\)/g;
  for (const m of src.matchAll(columnRe)) {
    sigs.push(`column ${m[1]}`);
  }

  // Relationships (SQLAlchemy ForeignKey, relationship)
  const relRe = /(?:ForeignKey|relationship)\s*\(\s*['"]([a-zA-Z_]\w*)['"]/g;
  for (const m of src.matchAll(relRe)) {
    sigs.push(`relation ${m[1]}`);
  }

  // Validators (@validator, @field_validator)
  const validatorRe = /@(?:validator|field_validator)\s*\(\s*['"]?([a-z_]\w*)(?:['"]|,|\s|\))/g;
  const validators = new Set();
  for (const m of src.matchAll(validatorRe)) {
    validators.add(m[1]);
  }
  for (const v of validators) {
    sigs.push(`validator ${v}`);
  }

  // Config class (Pydantic v1 / SQLAlchemy)
  if (/class\s+Config\s*:/.test(src)) {
    sigs.push('config-class');
  }

  return Array.from(new Set(sigs)).slice(0, 50);
}

module.exports = { extract };
