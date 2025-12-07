# Advanced JavaScript Topics

## Promises and Async/Await

Promises represent the eventual completion (or failure) of an asynchronous operation. The `async/await` syntax provides a cleaner way to work with promises.

```javascript
async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Closures

A closure is a function that has access to variables in its outer (enclosing) scope even after the outer function has returned.

```javascript
function outerFunction(x) {
  return function innerFunction(y) {
    return x + y;
  };
}
```

## Higher-Order Functions

Higher-order functions are functions that operate on other functions, either by taking them as arguments or by returning them.

```javascript
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
```

## ES6+ Features

Modern JavaScript includes many features like:
- Template literals
- Destructuring
- Spread operator
- Default parameters
- Arrow functions
