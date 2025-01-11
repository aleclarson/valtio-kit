# Variables

- First, let's talk about variables (i.e. `let` and `var`) separately from constants (i.e. `const`).
- The following rules only apply to variables declared at the root level of a `createClass` factory function. That means any variable declared in a nested function, `for` loop, `if` statement, etc. won't be transformed by the compiler.
- Variables are reactive. Referencing them in a `computed` or `watch` callback will cause the callback to rerun when the variable is re-assigned.
- Variables are _deeply_ reactive. Assigning an object literal, array literal, `new Map()`, or `new Set()` will make that data structure deeply reactive.
- Variables are bound to the **reactive instance** when you return them. This means any assignments to the variable will be reflected in the reactive instance, and the variable can be subscribed to (e.g. by a React component). It's a one-way binding, so you can rest assured that the variable won't be mutated from outside the `createClass` factory function.

## Constants

- Once again, the following rules only apply to variables declared at the root level of a `createClass` factory function.
- Since constants cannot be re-assigned, they are not reactive, but their values may be. For example, initializing a constant with an object literal, array literal, `new Map()`, or `new Set()` will make that data structure deeply reactive.
