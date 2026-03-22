const VARIABLE_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Replace `{{variable}}` placeholders with the supplied values.
 * Unresolved placeholders are left as-is.
 */
export function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(VARIABLE_RE, (match, name: string) =>
    name in variables ? (variables[name] as string) : match,
  );
}
