# Class Extensions

The "class extensions" API allows you to add static properties to your reactive classes. This feature was inspired by the new additions to the React entry point of `valtio-kit`, where each reactive class has a `Context` and `Provider` property.

## Usage

The `addClassExtension` function is used to add extensions to reactive classes. It takes a function that receives the constructor of the reactive class as an argument. Inside this function, you can add any properties or methods to the constructor.

```typescript
import {
  addClassExtension,
  ReactiveClass,
  InstanceFactory,
  ReactiveProxy,
} from 'valtio-kit'
import * as React from 'react'

declare module 'valtio-kit' {
  export interface ReactiveClass<TFactory extends InstanceFactory> {
    Context: React.Context<ReactiveProxy<TFactory> | null>
    Provider: React.Provider<ReactiveProxy<TFactory> | null>
  }
}

addClassExtension(constructor => {
  const Context = React.createContext<any>(null)
  constructor.Context = Context
  constructor.Provider = Context.Provider
})

// Now you can use the Context and Provider properties on your reactive class
const MyClass = createClass(() => {
  return {
    value: 1,
  }
})

// Use the context
const MyContext = MyClass.Context
const MyProvider = MyClass.Provider
```

This example demonstrates how to add a `Context` and `Provider` property to a reactive class, enabling easy integration with React's context API.
