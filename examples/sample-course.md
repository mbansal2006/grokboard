# Introduction to JavaScript

JavaScript is a high-level, interpreted programming language that is one of the core technologies of the World Wide Web, alongside HTML and CSS.

## Variables

Variables in JavaScript can be declared using `let`, `const`, or `var`. 

- `let` is used for variables that can be reassigned
- `const` is used for variables that cannot be reassigned
- `var` is the older way of declaring variables (not recommended in modern JavaScript)

## Functions

Functions are reusable blocks of code that perform a specific task. They can be declared using the `function` keyword or as arrow functions.

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}

const greetArrow = (name) => `Hello, ${name}!`;
```

## Arrays

Arrays are used to store multiple values in a single variable. They are zero-indexed, meaning the first element is at index 0.

```javascript
const fruits = ['apple', 'banana', 'orange'];
console.log(fruits[0]); // 'apple'
```

## Objects

Objects are collections of key-value pairs. They allow you to group related data together.

```javascript
const person = {
  name: 'John',
  age: 30,
  city: 'New York'
};
```

## Control Flow

JavaScript supports various control flow statements including `if/else`, `for` loops, `while` loops, and `switch` statements.

## Conclusion

JavaScript is a versatile language that powers interactive web applications. Understanding these fundamentals is essential for web development.
