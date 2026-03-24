/**
 * Named style registry.
 * Stores style bundles by name and expands style references in property objects.
 */
export class StyleRegistry {
  /** @param {Object<string, Object>} styles - name → property bundle */
  constructor(styles = {}) {
    this._styles = styles;
  }

  /** Retrieve a named style's properties (empty object if not found). */
  get(name) {
    return this._styles[name] ?? {};
  }

  /**
   * Expand a style reference in a props object.
   * If props.style is a string, look it up and merge: named style under per-element.
   * The 'style' key is removed from the result.
   * @param {Object} props
   * @returns {Object} new props with named style expanded
   */
  expand(props) {
    if (!props || typeof props.style !== 'string') return { ...props };
    const { style: styleName, ...rest } = props;
    const namedProps = this.get(styleName);
    return { ...namedProps, ...rest };
  }
}

/**
 * Resolve the merged group style for a node or edge.
 * Groups are processed in order; later groups override earlier ones.
 * @param {Array} groups - config.groups array
 * @param {string} type - 'nodes' or 'edges'
 * @param {string|number} id - node ID or edge index
 * @param {StyleRegistry} registry - for resolving named style refs in groups
 * @returns {Object} merged group style properties
 */
export function resolveGroupStyle(groups, type, id, registry) {
  if (!groups || !Array.isArray(groups)) return {};
  let merged = {};
  for (const group of groups) {
    const members = group[type];
    if (!members || !Array.isArray(members)) continue;
    if (!members.includes(id)) continue;
    const groupStyle = typeof group.style === 'string'
      ? registry.get(group.style)
      : (group.style || {});
    merged = { ...merged, ...groupStyle };
  }
  return merged;
}
