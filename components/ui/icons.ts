/**
 * Los iconos de la app, importados UNO A UNO por su ruta.
 *
 * `import { X } from "lucide-react-native"` trae el paquete entero al bundle web
 * (1.759 iconos, ~1,85 MB de los 5,4 MB de la entrada, el 34 %): Metro no hace
 * tree shaking. Cada icono se exporta aquí desde su fichero, y ESLint prohíbe el
 * import general (`eslint.config.js`). Un icono nuevo = una línea aquí; el nombre
 * de la ruta es el del icono en kebab-case (`lucide-react-native/icons/<nombre>`).
 */
export { default as Bell } from "lucide-react-native/icons/bell";
export { default as BookOpen } from "lucide-react-native/icons/book-open";
export { default as Check } from "lucide-react-native/icons/check";
export { default as ChevronLeft } from "lucide-react-native/icons/chevron-left";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
// `MoreHorizontal` es el alias antiguo de `Ellipsis` en lucide 1.x.
export { default as MoreHorizontal } from "lucide-react-native/icons/ellipsis";
export { default as House } from "lucide-react-native/icons/house";
export { default as User } from "lucide-react-native/icons/user";
export { default as Users } from "lucide-react-native/icons/users";
export { default as X } from "lucide-react-native/icons/x";

export type { LucideIcon } from "lucide-react-native";
